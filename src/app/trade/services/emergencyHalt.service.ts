import AppDataSource from "../../../db/data-source";
import { UserTradingAccount } from "../../../entity/UserTradingAccount";

export class EmergencyHaltService {
  async ensureSchema() {
    // Deployments created before the enum migration may use VARCHAR/TEXT for
    // account status. Never let this compatibility step prevent the server
    // from starting in those databases.
    try {
      const enumType = await AppDataSource.query(
        `SELECT 1 FROM pg_type WHERE typname = $1 LIMIT 1`,
        ["user_trading_accounts_status_enum"]
      );

      if (Array.isArray(enumType) && enumType.length > 0) {
        try {
          await AppDataSource.query(
            `ALTER TYPE user_trading_accounts_status_enum ADD VALUE IF NOT EXISTS 'halted'`
          );
        } catch (error: any) {
          console.warn(
            "[EmergencyHalt] Could not add halted to the account-status enum; continuing with the existing status column:",
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    } catch (error: any) {
      console.warn(
        "[EmergencyHalt] Could not inspect the account-status enum; continuing startup:",
        error instanceof Error ? error.message : String(error)
      );
    }
    await AppDataSource.query(`ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS master_trading_account_id bigint REFERENCES user_trading_accounts(id)`);
    await AppDataSource.query(`ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS mam_margin_reserved numeric(28,8)`);
    await AppDataSource.query(`ALTER TABLE trade_signals ALTER COLUMN volume TYPE numeric(28,8)`);
    await AppDataSource.query(`CREATE TABLE IF NOT EXISTS trading_emergency_halts (account_id bigint PRIMARY KEY REFERENCES user_trading_accounts(id), requested_by bigint NOT NULL REFERENCES users(id), requested_at timestamptz NOT NULL DEFAULT now(), state text NOT NULL DEFAULT 'pending', detail jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now())`);
  }

  async request(userId: number, scope: number | "ALL") {
    const ids: number[] = await AppDataSource.transaction(async manager => {
      const rows = await manager.query(`SELECT a.id FROM user_trading_accounts a WHERE ($2::bigint IS NULL OR a.id=$2) AND (a.user_id=$1 OR EXISTS(SELECT 1 FROM master_follower_links l JOIN user_trading_accounts m ON m.id=l.master_account_id WHERE m.user_id=$1 AND m.is_master=true AND l.follower_account_id=a.id AND l.is_active AND l.deleted_at IS NULL AND (a.user_id=m.user_id OR EXISTS(SELECT 1 FROM copy_trading_followers f WHERE f.master_id=m.id AND f.follower_trading_account_id=a.id AND f.status='active') OR EXISTS(SELECT 1 FROM copy_trading_masters c WHERE c.master_trading_account_id=m.id AND c.user_trading_account_id=a.id AND c.is_active AND c.deleted_at IS NULL))) OR EXISTS (SELECT 1 FROM copy_trading_masters l JOIN user_trading_accounts m ON m.id=l.master_trading_account_id WHERE m.user_id=$1 AND m.is_master=true AND l.user_trading_account_id=a.id AND l.is_active=true AND l.deleted_at IS NULL) OR EXISTS (SELECT 1 FROM copy_trading_followers f JOIN user_trading_accounts m ON m.id=f.master_id WHERE m.user_id=$1 AND m.is_master=true AND f.follower_trading_account_id=a.id AND f.status='active')) ORDER BY a.id FOR UPDATE OF a`, [userId, scope === "ALL" ? null : scope]);
      if (!rows.length) throw { statusCode: 404, message: "no_authorized_accounts" };
      const ids = rows.map((r: any) => Number(r.id));
      await manager.query(`UPDATE user_trading_accounts SET status='halted', account_meta=COALESCE(account_meta,'{}'::jsonb)||jsonb_build_object('emergencyHalt',true,'preHaltStatus',CASE WHEN status::text='halted' THEN account_meta->>'preHaltStatus' ELSE status::text END), updated_at=now() WHERE id=ANY($1::bigint[])`, [ids]);
      await manager.query(`UPDATE trade_signals_status s SET status='cancelled', last_error='emergency_halt', next_retry_at=NULL, updated_at=now() FROM trade_signals t WHERE s.signal_id=t.id AND t.trading_account_id=ANY($1::bigint[]) AND s.status='pending'`, [ids]);
      for (const id of ids) await manager.query(`INSERT INTO trading_emergency_halts(account_id,requested_by) VALUES($1,$2) ON CONFLICT(account_id) DO UPDATE SET state='pending',detail='{}',updated_at=now()`, [id,userId]);
      return ids;
    });
    return { halted: ids, cleanup: "pending", message: "Entry trading halted; broker cleanup is tracked separately." };
  }

  async resume(userId:number,accountId:number) {
    if(!Number.isSafeInteger(accountId)||accountId<=0)throw {statusCode:400,message:"invalid_account_id"};
    return AppDataSource.transaction(async manager=>{
      // Same account lock as broker cleanup; wait for an in-flight cleanup call to finish.
      await manager.query("SELECT pg_advisory_xact_lock(73001,$1::int)",[accountId]);
      const [account]=await manager.query("SELECT * FROM user_trading_accounts WHERE id=$1 AND user_id=$2 FOR UPDATE",[accountId,userId]);
      if(!account)throw {statusCode:404,message:"account_not_found"};
      if(account.status==='verified'&&!account.account_meta?.emergencyHalt)return {accountId,status:"verified",resumed:true};
      if(account.status!=='halted' && !(account.status==='verified' && account.account_meta?.emergencyHalt))throw {statusCode:409,message:"account_not_halted"};
      const [halt]=await manager.query("SELECT state FROM trading_emergency_halts WHERE account_id=$1",[accountId]);
      if(halt && !['confirmed','resumed'].includes(halt.state))throw {statusCode:409,message:"halt_cleanup_pending"};
      if(account.account_meta?.preHaltStatus!=='verified'&&!account.last_verified_at)throw {statusCode:409,message:"account_verification_required"};
      await manager.query("UPDATE trading_emergency_halts SET state='resumed',updated_at=now() WHERE account_id=$1",[accountId]);
      await manager.query(`UPDATE user_trading_accounts SET status='verified',is_enabled=true,account_meta=(COALESCE(account_meta,'{}'::jsonb)-'emergencyHalt'-'preHaltStatus'),updated_at=now() WHERE id=$1`,[accountId]);
      return {accountId,status:"verified",resumed:true};
    });
  }

  async processPending() {
    const tasks = await AppDataSource.query(`SELECT account_id FROM trading_emergency_halts WHERE state NOT IN ('confirmed','resumed') ORDER BY updated_at LIMIT 25`);
    for (const task of tasks) {
      const qr = AppDataSource.createQueryRunner();
      await qr.connect();
      try {
        const [lock] = await qr.query(`SELECT pg_try_advisory_lock(73001,$1::int) AS acquired`, [task.account_id]);
        if (!lock.acquired) continue;
        const [current]=await qr.query("SELECT state FROM trading_emergency_halts WHERE account_id=$1",[task.account_id]);
        if(!current || ['confirmed','resumed'].includes(current.state))continue;
        const account = await AppDataSource.getRepository(UserTradingAccount).findOneOrFail({ where: { id: Number(task.account_id) }, relations: { broker: true } });
        if(String(account.status)!=='halted'&&!account.accountMeta?.emergencyHalt)continue;
        const { BrokerOperationsService } = await import("./brokerOperations.service");
        const detail = await new BrokerOperationsService().halt(account);
        await qr.query(`UPDATE trading_emergency_halts SET state=$2,detail=detail||$3::jsonb,updated_at=now() WHERE account_id=$1`, [task.account_id, detail.confirmed ? "confirmed" : "pending", JSON.stringify(detail)]);
      } catch (error: any) {
        await qr.query(`UPDATE trading_emergency_halts SET state='retry',detail=detail||$2::jsonb,updated_at=now() WHERE account_id=$1`, [task.account_id, JSON.stringify({ error: error.message ?? "broker_cleanup_failed" })]);
      } finally {
        await qr.query(`SELECT pg_advisory_unlock(73001,$1::int)`, [task.account_id]);
        await qr.release();
      }
    }
  }
}
