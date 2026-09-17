import { EntityManager, IsNull } from "typeorm";
import AppDataSource from "../../../db/data-source";
import { MasterFollowerLink } from "../../../entity/MasterFollowerLink";
import { UserTradingAccount } from "../../../entity/UserTradingAccount";

const invalid = (message: string): never => { throw {statusCode:400,message}; };
export function validAccountId(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value<=0) invalid("invalid_account_id");
  return value as number;
}
export function validateMamSettings(input: any, partial=false) {
  if (!input || typeof input!=="object" || Array.isArray(input)) invalid("invalid_allocation");
  const out: Partial<MasterFollowerLink> = {};
  if (!partial || input.allocationType!==undefined) {
    if (!["MULTIPLIER","PROPORTIONAL_EQUITY"].includes(input.allocationType)) invalid("invalid_allocation_type");
    out.allocationType=input.allocationType;
  }
  for (const key of ["multiplier","maxAllocationLots"] as const) {
    if (key==="maxAllocationLots" && input[key]===null) {out[key]=null;continue;}
    if (input[key]!==undefined) {
      if (typeof input[key]!=="number" || !Number.isFinite(input[key]) || input[key]<1e-8 || input[key]>1e12) invalid(`invalid_${key}`);
      out[key]=input[key];
    }
  }
  if (input.isActive!==undefined) {if(typeof input.isActive!=="boolean")invalid("invalid_active_flag");out.isActive=input.isActive;}
  if (partial && !Object.keys(out).length) invalid("allocation_change_required");
  return out;
}
export class MamLinksService {
  async ensureSchema() {
    await AppDataSource.query(`CREATE TABLE IF NOT EXISTS master_follower_links (id serial PRIMARY KEY, master_account_id bigint NOT NULL REFERENCES user_trading_accounts(id) ON DELETE CASCADE, follower_account_id bigint NOT NULL REFERENCES user_trading_accounts(id) ON DELETE CASCADE, allocation_type varchar(30) NOT NULL DEFAULT 'MULTIPLIER' CHECK(allocation_type IN ('MULTIPLIER','PROPORTIONAL_EQUITY')), multiplier numeric(28,8) NOT NULL DEFAULT 1 CHECK(multiplier>0), max_allocation_lots numeric(28,8) CHECK(max_allocation_lots>0), is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, CONSTRAINT uq_mam_master_follower UNIQUE(master_account_id,follower_account_id), CHECK(master_account_id<>follower_account_id))`);
    await AppDataSource.query(`INSERT INTO master_follower_links(master_account_id,follower_account_id,allocation_type,multiplier)
      SELECT DISTINCT l.master_id,l.follower_id,CASE WHEN cfg->>'mode'='PROPORTIONAL_EQUITY' THEN 'PROPORTIONAL_EQUITY' ELSE 'MULTIPLIER' END,
      CASE WHEN cfg->>'multiplier' ~ '^[0-9]+(\\.[0-9]+)?$' AND length(cfg->>'multiplier')<20 THEN GREATEST((cfg->>'multiplier')::numeric,0.00000001) ELSE 1 END
      FROM (SELECT master_trading_account_id AS master_id,user_trading_account_id AS follower_id FROM copy_trading_masters WHERE is_active AND deleted_at IS NULL UNION SELECT master_id,follower_trading_account_id FROM copy_trading_followers WHERE status='active') l
      JOIN user_trading_accounts a ON a.id=l.follower_id JOIN user_trading_accounts m ON m.id=l.master_id
      CROSS JOIN LATERAL (SELECT COALESCE(a.account_meta->'mamAllocations'->(m.id::text),a.account_meta->'mam','{}'::jsonb) AS cfg) c
      WHERE l.master_id<>l.follower_id ON CONFLICT(master_account_id,follower_account_id) DO NOTHING`);
  }
  private async ownedMaster(manager: EntityManager,userId:number,id:number,requireMaster=false) {
    const master=await manager.getRepository(UserTradingAccount).findOne({where:{id,userId}});
    if(!master)throw {statusCode:404,message:"master_not_found"};
    if(requireMaster&&!master.isMaster)invalid("account_must_be_master");
    return master;
  }
  async list(userId:number,masterId:number) {
    validAccountId(masterId);
    await this.ownedMaster(AppDataSource.manager,userId,masterId);
    const links=await AppDataSource.getRepository(MasterFollowerLink).find({where:{masterAccountId:masterId,deletedAt:IsNull()},relations:{followerAccount:{broker:true}},order:{createdAt:"ASC"}});
    return links.map(l=>({id:Number(l.id),masterAccountId:Number(l.masterAccountId),followerAccountId:Number(l.followerAccountId),allocationType:l.allocationType,multiplier:Number(l.multiplier),maxAllocationLots:l.maxAllocationLots==null?null:Number(l.maxAllocationLots),isActive:l.isActive,createdAt:l.createdAt,follower:{label:l.followerAccount.accountLabel||l.followerAccount.accountId,broker:l.followerAccount.broker?.code,status:l.followerAccount.status}}));
  }
  private async preventCycle(manager:EntityManager,masterId:number,followerId:number) {
    const rows=await manager.query(`WITH RECURSIVE edges AS (SELECT master_account_id m,follower_account_id f FROM master_follower_links WHERE is_active AND deleted_at IS NULL UNION SELECT l.master_trading_account_id,l.user_trading_account_id FROM copy_trading_masters l WHERE l.is_active AND l.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM master_follower_links x WHERE x.master_account_id=l.master_trading_account_id AND x.follower_account_id=l.user_trading_account_id) UNION SELECT l.master_id,l.follower_trading_account_id FROM copy_trading_followers l WHERE l.status='active' AND NOT EXISTS(SELECT 1 FROM master_follower_links x WHERE x.master_account_id=l.master_id AND x.follower_account_id=l.follower_trading_account_id)), reachable(id) AS (SELECT $1::bigint UNION SELECT e.f FROM edges e JOIN reachable r ON e.m=r.id) SELECT id FROM reachable WHERE id=$2`,[followerId,masterId]);
    if(rows.length)invalid("mam_link_would_create_cycle");
  }
  async create(userId:number,input:any) {
    const masterId=validAccountId(input?.masterAccountId),followerId=validAccountId(input?.followerAccountId);
    if(masterId===followerId)invalid("master_cannot_follow_itself");
    const settings=validateMamSettings(input);
    return AppDataSource.transaction(async manager=>{
      await manager.query("SELECT pg_advisory_xact_lock(73003,0)");
      await this.ownedMaster(manager,userId,masterId,true);
      // Existing cross-user consent stays supported; new cross-user grants require the existing request/accept flow.
      const [authorized]=await manager.query(`SELECT a.id FROM user_trading_accounts a WHERE a.id=$1 AND (a.user_id=$2 OR EXISTS(SELECT 1 FROM copy_trading_masters l WHERE l.master_trading_account_id=$3 AND l.user_trading_account_id=a.id AND l.is_active AND l.deleted_at IS NULL) OR EXISTS(SELECT 1 FROM copy_trading_followers f WHERE f.master_id=$3 AND f.follower_trading_account_id=a.id AND f.status='active'))`,[followerId,userId,masterId]);
      if(!authorized)throw {statusCode:404,message:"authorized_follower_not_found"};
      if(settings.isActive!==false)await this.preventCycle(manager,masterId,followerId);
      const repo=manager.getRepository(MasterFollowerLink);
      const existing=await repo.findOne({where:{masterAccountId:masterId,followerAccountId:followerId}});
      if(existing&&!existing.deletedAt)throw {statusCode:409,message:"follower_already_linked"};
      return repo.save(repo.create({...existing,masterAccountId:masterId,followerAccountId:followerId,multiplier:1,maxAllocationLots:null,isActive:true,...settings,deletedAt:null}));
    });
  }
  async update(userId:number,id:number,input:any,remove=false) {
    validAccountId(id);const settings=remove?{isActive:false,deletedAt:new Date()}:validateMamSettings(input,true);
    return AppDataSource.transaction(async manager=>{
      await manager.query("SELECT pg_advisory_xact_lock(73003,0)");
      const repo=manager.getRepository(MasterFollowerLink);
      const link=await repo.findOne({where:{id,deletedAt:IsNull()}});
      if(!link)throw {statusCode:404,message:"mam_link_not_found"};
      await this.ownedMaster(manager,userId,Number(link.masterAccountId));
      if(!remove && settings.isActive===true)await this.preventCycle(manager,Number(link.masterAccountId),Number(link.followerAccountId));
      return repo.save({...link,...settings});
    });
  }
}
