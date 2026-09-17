import crypto from "crypto";
import AppDataSource from "../../../db/data-source";
import { UserTradingAccount } from "../../../entity/UserTradingAccount";
import { BrokerOperationsService, brokerRows } from "./brokerOperations.service";

export function normalizeFill(raw: any, code: string) {
  const futures = code === "COINDCX" && Boolean(raw.pair);
  const orderId = raw.order_id ?? raw.orderId ?? raw.norenordno;
  const id = raw.id ?? raw.exchangeTradeId ?? raw.flid ?? (futures && raw.timestamp != null ? crypto.createHash("sha256").update(JSON.stringify([raw.order_id,raw.timestamp,raw.side,raw.price,raw.quantity])).digest("hex") : undefined);
  const symbol = raw.symbol ?? raw.pair ?? raw.tradingSymbol ?? raw.tsym;
  const side = String(raw.side ?? raw.transactionType ?? raw.trantype).toUpperCase().replace(/^B$/, "BUY").replace(/^S$/, "SELL");
  let at: any = raw.timestamp ?? raw.executed_at ?? raw.created_at ?? raw.exchangeTime ?? raw.fltm;
  if (typeof at === "number") at = new Date(at < 1e12 ? at * 1000 : at);
  else if (typeof at === "string" && /^\d{2}-\d{2}-\d{4}/.test(at)) at = at.replace(/^(\d{2})-(\d{2})-(\d{4})[ T]/, "$3-$2-$1T") + "+05:30";
  else if (typeof at === "string" && /^\d{4}-\d{2}-\d{2} \d/.test(at)) at = at.replace(" ", "T") + "+05:30";
  const timestamp = new Date(at);
  const price = Number(raw.price ?? raw.tradedPrice ?? raw.flprc);
  const quantity = Number(raw.quantity ?? raw.tradedQuantity ?? raw.flqty);
  if (id == null || !orderId || !symbol || !["BUY","SELL"].includes(side) || !Number.isFinite(timestamp.getTime()) || !Number.isFinite(price) || price <= 0 || !Number.isFinite(quantity) || quantity <= 0) throw new Error("invalid_exchange_fill");
  const fee = raw.fee_amount ?? raw.fee ?? null;
  const currency = raw.currency ?? (code === "COINDCX" ? futures ? "USDT" : String(symbol).match(/(USDT|USDC|INR|BTC|ETH)$/)?.[1] : "INR");
  if (!currency || (fee !== null && (!Number.isFinite(Number(fee)) || Number(fee) < 0))) throw new Error("invalid_fill_currency_or_fee");
  return { id: `${futures ? "futures" : "spot"}:${String(id)}`, orderId: String(orderId), symbol: String(symbol), side, timestamp, price, quantity, fee: fee === null ? null : Number(fee), currency, realizedPnl: raw.realized_pnl == null ? null : Number(raw.realized_pnl) };
}

export class ReconciliationService {
  async ensureSchema() {
    await AppDataSource.query(`CREATE TABLE IF NOT EXISTS trade_fill_history (id bigserial PRIMARY KEY,account_id bigint NOT NULL REFERENCES user_trading_accounts(id),signal_id int REFERENCES trade_signals(id),fill_id text NOT NULL,order_id text NOT NULL,symbol text NOT NULL,side text NOT NULL,fill_price numeric(28,10) NOT NULL,fill_qty numeric(28,10) NOT NULL,fee numeric(28,10),currency text NOT NULL,executed_at timestamptz NOT NULL,realized_pnl numeric(28,10),UNIQUE(account_id,fill_id))`);
    await AppDataSource.query(`ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS execution_state text, ADD COLUMN IF NOT EXISTS broker_close_order_id text, ADD COLUMN IF NOT EXISTS protection_state text, ADD COLUMN IF NOT EXISTS protection_detail jsonb`);
    await AppDataSource.query(`ALTER TABLE alert_snapshots ALTER COLUMN volume TYPE numeric(28,8)`);
    await AppDataSource.query(`ALTER TABLE subscriber_trade_alerts ALTER COLUMN volume TYPE numeric(28,8)`);
  }
  async run(accountId?: number) {
    const accounts = await AppDataSource.getRepository(UserTradingAccount).createQueryBuilder("a").innerJoinAndSelect("a.broker", "b")
      .where("b.code IN (:...codes)", { codes: ["COINDCX","ZEBU","DHAN"] }).andWhere("a.status IN (:...statuses)", { statuses: ["verified","halted"] })
      .andWhere("(:id::bigint IS NULL OR a.id=:id)", { id: accountId ?? null }).getMany();
    for (const account of accounts) {
      const qr = AppDataSource.createQueryRunner(); await qr.connect();
      try {
        const [locked] = await qr.query(`SELECT pg_try_advisory_lock(73002,$1::int) AS acquired`, [account.id]);
        if (!locked.acquired) continue;
        await this.reconcileAccount(account);
      } catch (error: any) {
        await AppDataSource.query(`UPDATE user_trading_accounts SET account_meta=COALESCE(account_meta,'{}'::jsonb)||jsonb_build_object('reconciliationError',$2::text) WHERE id=$1`, [account.id, error.message ?? "reconciliation_failed"]);
      } finally { await qr.query(`SELECT pg_advisory_unlock(73002,$1::int)`, [account.id]); await qr.release(); }
    }
  }
  async reconcileAccount(account: UserTradingAccount) {
    const client = await new BrokerOperationsService().client(account);
    const code = account.broker.code;
    const signals = await AppDataSource.query(`SELECT * FROM trade_signals WHERE trading_account_id=$1 AND broker_order_id IS NOT NULL`, [account.id]);
    const fills = brokerRows(await client.getTradeHistory(Number(account.userId), account.id, signals)).map(f => normalizeFill(f, code));
    const orders = brokerRows(await client.getOrders(Number(account.userId), account.id));
    await AppDataSource.transaction(async manager => {
      for (const fill of fills) {
        const signal = signals.find((s: any) => [s.broker_order_id,s.broker_close_order_id,...(code === "COINDCX" ? s.protection_detail?.bracketOrderIds ?? [] : [])].includes(fill.orderId));
        await manager.query(`INSERT INTO trade_fill_history(account_id,signal_id,fill_id,order_id,symbol,side,fill_price,fill_qty,fee,currency,executed_at,realized_pnl) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(account_id,fill_id) DO UPDATE SET fee=COALESCE(EXCLUDED.fee,trade_fill_history.fee),realized_pnl=COALESCE(EXCLUDED.realized_pnl,trade_fill_history.realized_pnl),signal_id=COALESCE(trade_fill_history.signal_id,EXCLUDED.signal_id)`, [account.id,signal?.id??null,fill.id,fill.orderId,fill.symbol,fill.side,fill.price,fill.quantity,fill.fee,fill.currency,fill.timestamp,fill.realizedPnl]);
      }
      for (const signal of signals) {
        const exitOrderIds = [signal.broker_close_order_id,...(code === "COINDCX" ? signal.protection_detail?.bracketOrderIds ?? [] : [])].filter(Boolean);
        const [sum] = await manager.query(`SELECT COALESCE(SUM(fill_qty) FILTER(WHERE order_id=$2),0) AS entry,COALESCE(SUM(fill_qty) FILTER(WHERE order_id=ANY($3::text[])),0) AS exit FROM trade_fill_history WHERE account_id=$1`, [account.id,signal.broker_order_id,exitOrderIds]);
        const order = orders.find(o => String(o.id ?? o.orderId ?? o.norenordno) === signal.broker_order_id);
        const brokerStatus = String(order?.status ?? order?.orderStatus ?? "").toLowerCase();
        const filled = Number(sum.entry) >= Number(signal.volume);
        const state = filled ? "FILLED" : Number(sum.entry)>0 ? "PARTIALLY_FILLED" : ["cancelled","canceled","rejected"].includes(brokerStatus) ? brokerStatus.toUpperCase() : "SUBMITTED";
        await manager.query(`UPDATE trade_signals SET execution_state=$2,updated_at=now() WHERE id=$1`, [signal.id,state]);
        const expectedExit = code === "COINDCX" && Number(signal.protection_detail?.closeQuantity) > 0 ? Number(signal.protection_detail.closeQuantity) : Number(sum.entry);
        if (Number(sum.exit)>0 && Number(sum.exit)>=expectedExit) await manager.query(`UPDATE trade_signals_status SET status='closed',updated_at=now() WHERE signal_id=$1`, [signal.id]);
        else if (filled) await manager.query(`UPDATE trade_signals_status SET status='completed',updated_at=now() WHERE signal_id=$1 AND status IN ('submitted','partially_filled')`, [signal.id]);
        else if (Number(sum.entry)>0) await manager.query(`UPDATE trade_signals_status SET status='partially_filled',updated_at=now() WHERE signal_id=$1 AND status='submitted'`, [signal.id]);
      }
      await manager.query(`UPDATE user_trading_accounts SET account_meta=(COALESCE(account_meta,'{}'::jsonb)-'reconciliationError')||jsonb_build_object('reconciledAt',now()) WHERE id=$1`, [account.id]);
    });
    if (code === "COINDCX") {
      await client.cleanupClosedProtection(account);
      const filled = await AppDataSource.query(`SELECT t.* FROM trade_signals t JOIN trade_signals_status s ON s.signal_id=t.id WHERE t.trading_account_id=$1 AND t.execution_state='FILLED' AND s.status='completed' AND (t.instrument_type='FUTURES' OR t.symbol LIKE 'B-%' OR t.symbol LIKE 'BM-%') AND (t.stop_loss IS NOT NULL OR t.take_profit IS NOT NULL) AND COALESCE(t.protection_state,'')<>'ACTIVE'`, [account.id]);
      for (const signal of filled) {
        try { await client.protectFilledFutures(account,signal); }
        catch (error: any) { await AppDataSource.query(`UPDATE trade_signals SET protection_state='RETRY',protection_detail=COALESCE(protection_detail,'{}'::jsonb)||jsonb_build_object('error',$2::text) WHERE id=$1`, [signal.id,error.message ?? "protection_failed"]); }
      }
    }
    const { publishTradeEvent } = await import("./tradeEvents.service");
    await publishTradeEvent(Number(account.userId),account.id,"reconciled");
  }
}
