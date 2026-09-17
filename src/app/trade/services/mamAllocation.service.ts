import { MasterFollowerLink } from "../../../entity/MasterFollowerLink";
import AppDataSource from "../../../db/data-source";
import { QueryRunner } from "typeorm";
import { ICreateTradeSignal } from "../../broker/brokerSignals/interfaces/tradeSignal.interface";

export function allocateQuantity(quantity: number, mode: string, multiplier: number, masterEquity?: number, followerEquity?: number): number {
  let result: number;
  if (mode === "PROPORTIONAL_EQUITY") {
    if (!(Number(masterEquity) > 0) || !(Number(followerEquity) > 0)) throw new Error("mam_equity_unavailable");
    result = quantity * Number(followerEquity) / Number(masterEquity);
  } else if (mode === "MULTIPLIER") result = quantity * multiplier;
  else throw new Error("unsupported_mam_allocation");
  if (!Number.isFinite(result) || result <= 0) throw new Error("invalid_mam_quantity");
  return Math.floor(result * 1e8) / 1e8;
}

/** Extend the existing dispatch batch; a linked account appears only once per master signal. */
export async function allocateFollowers(input: ICreateTradeSignal[], runner: QueryRunner): Promise<ICreateTradeSignal[]> {
  if (!input.length) return input;
  const accountIds = [...new Set(input.map(s => s.tradingAccountId))];
  const accounts = await runner.manager.query(`SELECT * FROM user_trading_accounts WHERE id=ANY($1::bigint[])`, [accountIds]);
  const masters = accounts.filter((a: any) => a.is_master);
  const result = [...input];
  for (const master of masters) {
    const links = await runner.manager.getRepository(MasterFollowerLink).find({where:{masterAccountId:Number(master.id)}});
    const activeFollowerIds = links.filter(l=>l.isActive&&!l.deletedAt).map(l=>Number(l.followerAccountId));
    const overriddenFollowerIds = links.map(l=>Number(l.followerAccountId));
    const followers = await runner.manager.query(`SELECT DISTINCT a.* FROM user_trading_accounts a WHERE a.id<>$1 AND a.is_enabled=true AND a.status='verified' AND ((a.id=ANY($2::bigint[]) AND (a.user_id=$4 OR EXISTS(SELECT 1 FROM copy_trading_followers c WHERE c.master_id=$1 AND c.follower_trading_account_id=a.id AND c.status='active') OR EXISTS(SELECT 1 FROM copy_trading_masters c WHERE c.master_trading_account_id=$1 AND c.user_trading_account_id=a.id AND c.is_active AND c.deleted_at IS NULL))) OR (NOT(a.id=ANY($3::bigint[])) AND (EXISTS (SELECT 1 FROM copy_trading_masters l WHERE l.master_trading_account_id=$1 AND l.user_trading_account_id=a.id AND l.is_active=true AND l.deleted_at IS NULL) OR EXISTS (SELECT 1 FROM copy_trading_followers f WHERE f.master_id=$1 AND f.follower_trading_account_id=a.id AND f.status='active'))))`, [master.id,activeFollowerIds,overriddenFollowerIds,master.user_id]);
    for (const source of input.filter(s => Number(s.tradingAccountId) === Number(master.id))) {
      if (source.executionMode === "AMEND_SLTP") continue;
      for (const follower of followers) {
        const existing = result.find(s => Number(s.tradingAccountId) === Number(follower.id) && s.symbol === source.symbol && s.action === source.action && s.alertSnapshotsId === source.alertSnapshotsId);
        const child = existing ?? { ...source, userId: Number(follower.user_id), tradingAccountId: Number(follower.id) };
        child.masterTradingAccountId = Number(master.id);
        child.subscriptionId = follower.subscription_id == null ? null : Number(follower.subscription_id);
        const link = links.find(l=>Number(l.followerAccountId)===Number(follower.id));
        const config = link ? {mode:link.allocationType,multiplier:link.multiplier,maxAllocationLots:link.maxAllocationLots} : follower.account_meta?.mamAllocations?.[String(master.id)] ?? follower.account_meta?.mam ?? {};
        try {
          const mode = String(config.mode ?? "MULTIPLIER").toUpperCase();
          const m = master.account_meta?.brokerSnapshot, f = follower.account_meta?.brokerSnapshot;
          if (mode === "PROPORTIONAL_EQUITY" && (!m || !f || m.currency !== f.currency || Date.now() - Date.parse(m.asOf) > 60000 || Date.now() - Date.parse(f.asOf) > 60000 || !Number.isFinite(Date.parse(m.asOf)) || !Number.isFinite(Date.parse(f.asOf)))) throw new Error("mam_equity_unavailable_or_stale");
          child.volume = allocateQuantity(Number(source.volume), mode, Number(config.multiplier ?? 1), m?.equity, f?.equity);
          if(config.maxAllocationLots!=null) child.volume=Math.min(child.volume,Number(config.maxAllocationLots));
        } catch (error) { child.allocationError = (error as Error).message; }
        if (!existing) result.push(child);
      }
    }
  }
  return result;
}

const followerLink = `(EXISTS (SELECT 1 FROM copy_trading_masters l WHERE l.master_trading_account_id=m.id AND l.user_trading_account_id=a.id AND l.is_active=true AND l.deleted_at IS NULL) OR EXISTS (SELECT 1 FROM copy_trading_followers f WHERE f.master_id=m.id AND f.follower_trading_account_id=a.id AND f.status='active'))`;
export async function getMamFollowers(userId:number,masterId:number) {
  if (!Number.isSafeInteger(masterId) || masterId<=0) throw {statusCode:400,message:"invalid_master_id"};
  const [master]=await AppDataSource.query(`SELECT id FROM user_trading_accounts WHERE id=$1 AND user_id=$2 AND is_master=true`,[masterId,userId]);
  if (!master) throw {statusCode:404,message:"master_not_found"};
  return AppDataSource.query(`SELECT a.id,a.account_label AS label,a.account_id AS "accountId",b.code AS broker,a.status,a.is_enabled AS "isEnabled",COALESCE(a.account_meta->'mamAllocations'->(($1::bigint)::text),a.account_meta->'mam','{"mode":"MULTIPLIER","multiplier":1}'::jsonb) AS allocation FROM user_trading_accounts m JOIN user_trading_accounts a ON a.id<>m.id JOIN brokers b ON b.id=a.broker_id WHERE m.id=$1 AND m.user_id=$2 AND m.is_master=true AND ${followerLink} ORDER BY a.id`,[masterId,userId]);
}
export async function saveMamAllocation(userId:number,masterId:number,followerId:number,input:any) {
  if (![masterId,followerId].every(id=>Number.isSafeInteger(id)&&id>0)) throw {statusCode:400,message:"invalid_account_id"};
  const mode=input?.mode;
  if (!["PROPORTIONAL_EQUITY","MULTIPLIER"].includes(mode) || (mode==="MULTIPLIER" && (typeof input.multiplier!=="number" || !Number.isFinite(input.multiplier) || input.multiplier<=0))) throw {statusCode:400,message:"invalid_allocation"};
  const config={mode,...(mode==="MULTIPLIER"?{multiplier:input.multiplier}:{})};
  const rows=await AppDataSource.query(`UPDATE user_trading_accounts a SET account_meta=COALESCE(a.account_meta,'{}'::jsonb)||jsonb_build_object('mamAllocations',COALESCE(a.account_meta->'mamAllocations','{}'::jsonb)||jsonb_build_object(($1::bigint)::text,$4::jsonb)),updated_at=now() FROM user_trading_accounts m WHERE m.id=$1 AND m.user_id=$2 AND m.is_master=true AND a.id=$3 AND ${followerLink} RETURNING a.id`,[masterId,userId,followerId,JSON.stringify(config)]);
  if (!rows[0]?.length) throw {statusCode:404,message:"active_follower_not_found"};
  await AppDataSource.getRepository(MasterFollowerLink).update({masterAccountId:masterId,followerAccountId:followerId},{allocationType:mode,multiplier:mode==="MULTIPLIER"?input.multiplier:1});
}
