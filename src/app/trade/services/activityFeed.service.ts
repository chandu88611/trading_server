import AppDataSource from "../../../db/data-source";
const messages: Record<string,string> = {
  daily_loss_limit:"Daily loss limit reached",daily_profit_target:"Daily profit target reached",max_trades_per_day:"Maximum daily trades reached",max_lot_per_trade:"Trade exceeds your size limit",max_open_positions:"Maximum open positions reached",account_not_ready:"Account is paused or requires verification",account_paused:"Trading is paused",coindcx_below_min_notional:"Order value is below the exchange minimum",coindcx_below_min_quantity:"Order size is below the exchange minimum",insufficient_balance:"Insufficient available balance",token_expired:"Broker session expired. Re-authenticate your account.",mam_equity_unavailable:"Current account equity is unavailable",emergency_halt:"Trading was halted",no_active_subscription_for_market:"An active subscription is required",live_execution_disabled:"Live execution is disabled",
};
export function publicActivity(row:any) {
  const raw=String(row.reason??"").toLowerCase();
  let reason=Object.keys(messages).find(key=>raw.includes(key));
  if(!reason && /insufficient|not enough.*(balance|fund)/.test(raw))reason="insufficient_balance";
  if(!reason && /(token|session).*(expired|invalid)|unauthorized|invalid.*(token|session)/.test(raw))reason="token_expired";
  const status=String(row.status).toLowerCase();
  const kind=status==='rejected_risk_limit'?"GUARD_BLOCKED":["rejected","failed","close_blocked"].includes(status)?"REJECTED":"STATUS_CHANGED";
  const label=({completed:"Filled",executed:"Filled",closed:"Closed",completed_close:"Closed",submitted:"Submitted",partially_filled:"Partially filled"} as Record<string,string>)[status]??"Status updated";
  return {id:String(row.id),accountId:Number(row.account_id),signalId:Number(row.signal_id),symbol:row.symbol,status:row.status,kind,createdAt:row.created_at,message:reason?messages[reason]:kind==='GUARD_BLOCKED'?"A trading risk check blocked this order":kind==='REJECTED'?"Order could not be executed. Review your account settings.":label};
}
export class ActivityFeedService {
  async ensureSchema() {
    await AppDataSource.query(`CREATE TABLE IF NOT EXISTS trade_activity_events(id bigserial PRIMARY KEY,user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,account_id bigint NOT NULL REFERENCES user_trading_accounts(id) ON DELETE CASCADE,signal_id int NOT NULL REFERENCES trade_signals(id) ON DELETE CASCADE,symbol text NOT NULL,status text NOT NULL,reason text,created_at timestamptz NOT NULL DEFAULT now())`);
    await AppDataSource.query(`CREATE INDEX IF NOT EXISTS idx_trade_activity_user_time ON trade_activity_events(user_id,created_at DESC,id DESC)`);
    await AppDataSource.query(`CREATE OR REPLACE FUNCTION record_trade_activity() RETURNS trigger AS $$ BEGIN
      IF TG_OP='UPDATE' THEN IF NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.last_error IS NOT DISTINCT FROM OLD.last_error THEN RETURN NEW; END IF; END IF;
      IF lower(NEW.status) IN ('submitted','completed','executed','closed','completed_close','partially_filled','rejected_risk_limit','rejected','failed','close_blocked') THEN
        INSERT INTO trade_activity_events(user_id,account_id,signal_id,symbol,status,reason) SELECT user_id,trading_account_id,id,symbol,NEW.status,NEW.last_error FROM trade_signals WHERE id=NEW.signal_id;
      END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await AppDataSource.query(`DROP TRIGGER IF EXISTS trade_activity_status_change ON trade_signals_status`);
    await AppDataSource.query(`CREATE TRIGGER trade_activity_status_change AFTER INSERT OR UPDATE OF status,last_error ON trade_signals_status FOR EACH ROW EXECUTE FUNCTION record_trade_activity()`);
    await AppDataSource.query(`INSERT INTO trade_activity_events(user_id,account_id,signal_id,symbol,status,reason,created_at) SELECT t.user_id,t.trading_account_id,t.id,t.symbol,s.status,s.last_error,s.updated_at FROM trade_signals t JOIN trade_signals_status s ON s.signal_id=t.id WHERE lower(s.status) IN ('submitted','completed','executed','closed','completed_close','partially_filled','rejected_risk_limit','rejected','failed','close_blocked') AND NOT EXISTS(SELECT 1 FROM trade_activity_events e WHERE e.signal_id=t.id)`);
  }
  async list(userId:number,accountId?:number) {
    if(accountId!==undefined && (!Number.isSafeInteger(accountId)||accountId<=0))throw {statusCode:400,message:"invalid_account_id"};
    const rows=await AppDataSource.query(`SELECT * FROM trade_activity_events WHERE user_id=$1 AND ($2::bigint IS NULL OR account_id=$2) ORDER BY created_at DESC,id DESC LIMIT 20`,[userId,accountId??null]);
    return rows.map(publicActivity);
  }
}
