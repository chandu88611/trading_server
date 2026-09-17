import AppDataSource from "../../../db/data-source";
import { AssetClassifier, AssetType, MarketType } from "../../../types/trade-identify";
import { UserSubscriptionDBService } from "../../userSubscription/services/userSubscription.db";
import { User } from "../../../entity";

export type TradeCheckInput = { userId: number; symbol: string; exchange?: string | null; notional?: number | null; lotSize?: number | null };
export type TradeCheckResult = { allowed: boolean; reason?: string; subscriptionId?: number | null; haltUntil?: string };
export const RISK_REJECTED = "REJECTED_RISK_LIMIT";
const markets = ["FOREX", "INDIA", "CRYPTO", "COPY"];
const numericFields = ["maxTradesPerDay", "maxOpenPositions", "maxLotPerTrade", "maxDrawdownPct", "cooldownAfterLossMins", "maxConsecutiveLosses", "pauseAfterConsecutiveLossesMins", "dailyMaxLoss", "dailyProfitTarget", "minGainPerDay"];

/** Validate the existing settings document without allowing arbitrary executable configuration. */
export function validateRiskConfiguration(config: any): void {
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("invalid_risk_configuration");
  const walk = (value: any, depth = 0) => {
    if (depth > 4) throw new Error("invalid_risk_configuration");
    for (const [key, v] of Object.entries(value)) {
      if (numericFields.includes(key) && v !== null && (typeof v !== "number" || !Number.isFinite(v) || v < 0)) throw new Error(`invalid_${key}`);
      if (["maxTradesPerDay", "maxOpenPositions", "maxConsecutiveLosses"].includes(key) && v != null && !Number.isInteger(v)) throw new Error(`invalid_${key}`);
      if (key === "maxDrawdownPct" && Number(v) > 100) throw new Error("invalid_maxDrawdownPct");
      if (["enabled", "masterPause", "sessionEnabled", "pauseTrading", "closePositions", "notify", "email", "telegram"].includes(key) && typeof v !== "boolean") throw new Error(`invalid_${key}`);
      if (v && typeof v === "object" && !Array.isArray(v)) walk(v, depth + 1);
    }
  };
  walk(config);
  if (config.executionMode !== undefined && !["EXECUTION", "SIGNALS_ONLY", "PAPER"].includes(config.executionMode)) throw new Error("invalid_execution_mode");
  if (config.allowedMarkets && markets.some(m => typeof config.allowedMarkets[m] !== "boolean")) throw new Error("invalid_allowed_markets");
  if (config.sessionDays && (!Array.isArray(config.sessionDays) || config.sessionDays.some((d: any) => !Number.isInteger(d) || d < 0 || d > 6))) throw new Error("invalid_session_days");
  for (const key of ["sessionStart", "sessionEnd"]) {
    if (config[key] !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(config[key])) throw new Error(`invalid_${key}`);
  }
  if (config.pauseUntil && !Number.isFinite(Date.parse(config.pauseUntil))) throw new Error("invalid_pause_until");
}

export function isExitSignal(signal: any): boolean {
  return ["CLOSE", "EXIT", "AMEND", "AMEND_SLTP", "MODIFY"].includes(String(signal.executionMode ?? "").toUpperCase()) ||
    ["CLOSE", "EXIT"].includes(String(signal.action ?? "").toUpperCase()) ||
    ["pending_close", "in_progress_close", "closing"].includes(String(signal.status?.status ?? signal.status ?? ""));
}

/** Pure evaluation for deterministic boundary tests using recorded account metrics. */
export function evaluateRisk(rules: any, stats: any, market: string, signal: any, now = new Date()): TradeCheckResult {
  const cfg = rules.configuration ?? {};
  const denied = (reason: string, haltUntil?: Date): TradeCheckResult => ({ allowed: false, reason, ...(haltUntil ? { haltUntil: haltUntil.toISOString() } : {}) });
  if (cfg.masterPause && (!cfg.pauseUntil || Date.parse(cfg.pauseUntil) > now.getTime())) return denied("account_paused");
  if (cfg.executionMode && cfg.executionMode !== "EXECUTION") return denied("live_execution_disabled");
  if (cfg.allowedMarkets?.[market] === false || ((signal.isCopy || signal.masterTradingAccountId) && cfg.allowedMarkets?.COPY === false)) return denied("market_disabled");
  if (!rules.isEnabled) return { allowed: true };
  const override = cfg.perMarketOverride?.[market];
  const useOverride = override?.enabled === true;
  const limits = useOverride ? { ...cfg, ...override } : cfg;
  const guard = useOverride ? override.guards : null;
  const loss = guard?.dailyMaxLoss ?? rules.dailyLossLimit;
  const profit = guard?.dailyProfitTarget ?? rules.dailyProfitTarget;
  const maxTrades = limits.maxTradesPerDay ?? rules.maxTradesPerDay;
  // Session clock is explicit India time; overnight windows belong to their starting day.
  const local = new Date(now.getTime() + 330 * 60000);
  const time = local.toISOString().slice(11, 16);
  const start = cfg.sessionStart ?? "00:00", end = cfg.sessionEnd ?? "23:59";
  const overnight = start > end;
  const day = overnight && time < end ? (local.getUTCDay() + 6) % 7 : local.getUTCDay();
  if (cfg.sessionEnabled && (!(cfg.sessionDays ?? []).includes(day) || !(overnight ? time >= start || time < end : time >= start && time < end))) return denied("outside_trading_session");
  if (limits.maxLotPerTrade != null && Math.abs(Number(signal.volume ?? signal.quantity ?? 0)) > limits.maxLotPerTrade) return denied("max_lot_per_trade");
  const tomorrow = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1) - 330 * 60000);
  if (maxTrades != null && stats.tradesToday >= maxTrades) return denied("max_trades_per_day", tomorrow);
  if (limits.maxOpenPositions != null && stats.openPositions >= limits.maxOpenPositions) return denied("max_open_positions");
  const monetary = loss != null || profit != null || cfg.maxDrawdownPct != null || Number(rules.cooldownAfterLossMins) > 0 || cfg.maxConsecutiveLosses != null;
  const m = stats.metrics;
  if (monetary && (!m || m.day !== local.toISOString().slice(0, 10) || !Number.isFinite(Date.parse(m.asOf)) || now.getTime() - Date.parse(m.asOf) > 60000 || Date.parse(m.asOf) > now.getTime() + 5000)) return denied("risk_metrics_unavailable_or_stale");
  if (loss != null && (!Number.isFinite(m?.dailyPnl) || m.dailyPnl <= -loss)) return denied(Number.isFinite(m?.dailyPnl) ? "daily_loss_limit" : "risk_metrics_unavailable", tomorrow);
  if (profit != null && (!Number.isFinite(m?.dailyPnl) || m.dailyPnl >= profit)) return denied(Number.isFinite(m?.dailyPnl) ? "daily_profit_target" : "risk_metrics_unavailable", tomorrow);
  if (cfg.maxDrawdownPct != null && (!Number.isFinite(m?.drawdownPct) || m.drawdownPct >= cfg.maxDrawdownPct)) return denied(Number.isFinite(m?.drawdownPct) ? "drawdown_limit" : "risk_metrics_unavailable", tomorrow);
  if (Number(rules.cooldownAfterLossMins) > 0) {
    if (m?.lastLossAt === undefined) return denied("risk_metrics_unavailable");
    const until = Date.parse(m.lastLossAt) + rules.cooldownAfterLossMins * 60000;
    if (until > now.getTime()) return denied("loss_cooldown", new Date(until));
  }
  if (cfg.maxConsecutiveLosses != null) {
    if (!Number.isInteger(m?.consecutiveLosses)) return denied("risk_metrics_unavailable");
    if (m.consecutiveLosses >= cfg.maxConsecutiveLosses) {
      const until = cfg.pauseAfterConsecutiveLossesMins ? new Date(Date.parse(m.lastLossAt) + cfg.pauseAfterConsecutiveLossesMins * 60000) : tomorrow;
      if (!Number.isFinite(until.getTime())) return denied("risk_metrics_unavailable");
      if (until > now) return denied("consecutive_loss_cooldown", until);
    }
  }
  return { allowed: true };
}

/**
 * Build account-day results from confirmed fills attached to persisted trades.
 * Signal prices are deliberately excluded: they are requested prices, not fills.
 * Quantities in a fill are executed quantities; derivative fills must include
 * their contract multiplier or broker-reported realized P&L in account currency.
 */
export function calculateAccountRiskMetrics(records: any[], now = new Date(), openingBalance?: number) {
  const day = new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10);
  const start = Date.parse(`${day}T00:00:00+05:30`);
  const fills: any[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    const history = record.fillHistory ?? record.fill_history;
    // Missing history contributes no realized P&L; it must not prevent new entries.
    // Continue processing other records so recorded losses still enforce limits.
    if (!Array.isArray(history) || !history.length) {
      continue;
    }
    for (const fill of history) {
      const id = String(fill.id ?? "");
      const at = Date.parse(fill.executedAt ?? fill.timestamp ?? "");
      if (!id || !Number.isFinite(at) || at > now.getTime()) return null;
      const key = `${record.symbol}:${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      fills.push({ ...fill, symbol: record.symbol, assetType: record.assetType ?? record.asset_type, at });
    }
  }
  fills.sort((a, b) => a.at - b.at || String(a.id).localeCompare(String(b.id)));
  const lots = new Map<string, { side: string; quantity: number; price: number; multiplier: number }[]>();
  let dailyPnl = 0, consecutiveLosses = 0, lastLossAt: string | null = null;
  let equity = Number.isFinite(openingBalance) ? Number(openingBalance) : NaN;
  let peak = equity, drawdownPct = Number.isFinite(equity) && equity > 0 ? 0 : NaN;
  let currency: string | undefined;
  let feesComplete = true;
  for (const fill of fills) {
    if (!fill.currency || (currency && fill.currency !== currency)) return null;
    currency = fill.currency;
    const side = String(fill.side ?? "").toUpperCase();
    const price = Number(fill.price), quantity = Number(fill.quantity);
    if (fill.fee == null) feesComplete = false;
    const fee = fill.fee == null ? 0 : Number(fill.fee);
    const multiplier = fill.contractMultiplier == null
      ? ["FOREX", "FUTURES", "OPTIONS"].includes(String(fill.assetType).toUpperCase()) ? NaN : 1
      : Number(fill.contractMultiplier);
    if (!["BUY", "SELL"].includes(side) || !(quantity > 0) || !(price > 0) || !Number.isFinite(fee) || fee < 0) return null;
    const queue = lots.get(fill.symbol) ?? [];
    let remaining = quantity, realized = 0, closedQuantity = 0;
    while (remaining > 1e-10 && queue.length && queue[0].side !== side) {
      const entry = queue[0];
      const closed = Math.min(remaining, entry.quantity);
      if (!Number.isFinite(entry.multiplier) && !Number.isFinite(fill.realizedPnl)) return null;
      realized += (price - entry.price) * closed * entry.multiplier * (entry.side === "BUY" ? 1 : -1);
      remaining -= closed;
      entry.quantity -= closed;
      closedQuantity += closed;
      if (entry.quantity < 1e-10) queue.shift();
    }
    if (remaining > 1e-10) queue.push({ side, quantity: remaining, price, multiplier });
    lots.set(fill.symbol, queue);
    if (fill.realizedPnl !== undefined) {
      if (typeof fill.realizedPnl !== "number" || !Number.isFinite(fill.realizedPnl)) return null;
      realized = fill.realizedPnl;
    }
    if (fill.at < start) continue;
    const net = realized - fee;
    dailyPnl += net;
    if (closedQuantity > 0 || fill.realizedPnl !== undefined) {
      if (net < 0) { consecutiveLosses += 1; lastLossAt = new Date(fill.at).toISOString(); }
      else if (net > 0) consecutiveLosses = 0;
    }
    if (Number.isFinite(equity)) {
      equity += net;
      peak = Math.max(peak, equity);
      if (peak > 0) drawdownPct = Math.max(drawdownPct, (peak - equity) / peak * 100);
    }
  }
  if (!fills.some(fill => fill.at >= start)) drawdownPct = 0;
  return { day, asOf: now.toISOString(), dailyPnl, consecutiveLosses, lastLossAt, drawdownPct, currency, feesComplete,
    openPositions: [...lots.values()].filter(queue => queue.length > 0).length };
}

export class TradeGuardService {
  async checkTradeAllowed(input: TradeCheckInput): Promise<TradeCheckResult> {
    const user = await AppDataSource.getRepository(User).findOne({ where: { id: input.userId } });
    if (!user?.allowTrade) return { allowed: false, reason: "trade_not_allowed_for_user" };
    const asset = AssetClassifier.detect({ symbol: input.symbol, exchange: input.exchange });
    const market = asset === AssetType.FOREX ? MarketType.FOREX : asset === AssetType.CRYPTO ? MarketType.CRYPTO : asset === AssetType.UNKNOWN ? null : MarketType.INDIAN;
    if (!market) return { allowed: false, reason: "unknown_asset_type" };
    const sub = await new UserSubscriptionDBService().subscriberPlanValidation(input.userId, market);
    return sub ? { allowed: true, subscriptionId: sub.id } : { allowed: false, reason: "no_active_subscription_for_market" };
  }

  async validateTrade(account: any, signal: any): Promise<TradeCheckResult> {
    // Risk-reducing exits must remain executable during a trading halt.
    if (isExitSignal(signal)) return { allowed: true };
    const id = Number(account?.id ?? signal.tradingAccountId);
    if (!Number.isSafeInteger(id) || id <= 0) return this.reject(signal, "missing_trading_account");
    try {
      const result = await AppDataSource.transaction(async manager => {
        // Serialize reservations per account across worker processes.
        const [a] = await manager.query(`SELECT a.*, b.market_category, b.is_active AS broker_active, u.allow_trade, u.is_admin FROM user_trading_accounts a JOIN brokers b ON b.id=a.broker_id JOIN users u ON u.id=a.user_id WHERE a.id=$1 FOR UPDATE OF a`, [id]);
        if (!a || a.broker_active === false || !a.is_enabled || a.account_meta?.emergencyHalt === true || String(a.status).toLowerCase() !== "verified") return { allowed: false, reason: "account_not_ready" };
        const [r] = await manager.query(`SELECT is_enabled AS "isEnabled", daily_loss_limit AS "dailyLossLimit", daily_profit_target AS "dailyProfitTarget", max_trades_per_day AS "maxTradesPerDay", cooldown_after_loss_mins AS "cooldownAfterLossMins", configuration FROM user_risk_limits WHERE user_id=$1`, [a.user_id]);
        const rules = r ?? { isEnabled: false, configuration: {} };
        for (const k of ["dailyLossLimit", "dailyProfitTarget", "maxTradesPerDay", "cooldownAfterLossMins"]) if (rules[k] != null) rules[k] = Number(rules[k]);
        const scheduledPauseExpired = rules.configuration?.masterPause && rules.configuration?.pauseUntil && Date.parse(rules.configuration.pauseUntil) <= Date.now();
        if (!a.allow_trade && !scheduledPauseExpired) return { allowed: false, reason: "trade_not_allowed_for_user" };
        const subscriptionId = signal.subscriptionId ?? a.subscription_id;
        if (!(a.is_admin && a.is_master)) {
          const [sub] = await manager.query(`SELECT s.id FROM user_subscriptions s JOIN subscription_plans p ON p.id=s.plan_id JOIN markets m ON m.id=p.market_id WHERE s.user_id=$1 AND s.status_v2='active' AND s.execution_enabled=true AND p.is_active=true AND (s.end_date IS NULL OR s.end_date>NOW()) AND ($2::bigint IS NULL OR s.id=$2) AND (m.code=$3 OR (m.code='INDIAN' AND $3='INDIA')) LIMIT 1`, [a.user_id, subscriptionId ?? null, a.market_category]);
          if (!sub) return { allowed: false, reason: "no_active_execution_subscription" };
        }
        const halt = a.account_meta?.riskHalt;
        if (rules.isEnabled && halt?.until && Date.parse(halt.until) > Date.now() && halt.rulesUpdatedAt === JSON.stringify(rules)) return { allowed: false, reason: halt.reason };
        if (signal.masterTradingAccountId) {
          const snapshot = a.account_meta?.brokerSnapshot;
          const asOf = Date.parse(snapshot?.asOf ?? "");
          const unitMargin = Number(snapshot?.marginPerUnit?.[signal.symbol]);
          const required = Math.abs(Number(signal.volume)) * unitMargin;
          if (!Number.isFinite(asOf) || Date.now() - asOf > 60000 || asOf > Date.now() + 5000 || !Number.isFinite(required) || required <= 0 || !Number.isFinite(Number(snapshot?.freeMargin))) return { allowed: false, reason: "follower_margin_unavailable" };
          const [reserved] = await manager.query(`SELECT COALESCE(SUM(t.mam_margin_reserved),0) AS amount FROM trade_signals t JOIN trade_signals_status s ON s.signal_id=t.id WHERE t.trading_account_id=$1 AND t.id<>$2 AND s.status IN ('in_progress','submitted','partially_filled') AND (s.status='in_progress' OR t.risk_reserved_at>$3::timestamptz)`, [id, signal.id, snapshot.asOf]);
          if (required + Number(reserved.amount) > Number(snapshot.freeMargin)) return { allowed: false, reason: "follower_insufficient_free_margin" };
          await manager.query(`UPDATE trade_signals SET mam_margin_reserved=$2 WHERE id=$1`, [signal.id, required]);
        }
        const [stats] = await manager.query(`SELECT COUNT(*) FILTER (WHERE COALESCE(t.risk_reserved_at,t.created_at) >= (date_trunc('day',NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'))::int AS "tradesToday", COUNT(*) FILTER (WHERE s.status NOT IN ('closed','completed_close'))::int AS "openPositions" FROM trade_signals t JOIN trade_signals_status s ON s.signal_id=t.id WHERE t.trading_account_id=$1 AND t.id<>$2 AND COALESCE(UPPER(t.execution_mode),'OPEN') NOT IN ('CLOSE','EXIT','AMEND','MODIFY') AND (s.status IN ('executed','completed','submitted','partially_filled','pending_close','in_progress_close') OR (s.status='in_progress' AND t.risk_reserved_at IS NOT NULL) OR (s.status='closed'))`, [id, signal.id ?? 0]);
        const ledger = await manager.query(`SELECT t.symbol, t.asset_type, t.broker_order_id, st.status, to_jsonb(t)->'fill_history' AS "fillHistory" FROM trade_signals t JOIN trade_signals_status st ON st.signal_id=t.id WHERE t.trading_account_id=$1 AND t.id<>$2 ORDER BY t.created_at,t.id`, [id, signal.id ?? 0]);
        const confirmed = await manager.query(`SELECT symbol,jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',fill_id,'executedAt',executed_at,'side',side,'price',fill_price::float8,'quantity',fill_qty::float8,'fee',fee::float8,'currency',currency,'realizedPnl',realized_pnl::float8,'contractMultiplier',1)) ORDER BY executed_at,id) AS "fillHistory" FROM trade_fill_history WHERE account_id=$1 GROUP BY symbol`, [id]);
        const metrics = calculateAccountRiskMetrics(confirmed.length ? confirmed : ledger, new Date(), Number(a.account_meta?.openingBalance));
        let result = evaluateRisk(rules, { ...stats, metrics }, String(a.market_category).replace("INDIAN", "INDIA"), signal);
        const [admin] = await manager.query(`SELECT data FROM admin_risk_rules WHERE id=1`);
        if (result.allowed && admin?.data?.isEnabled) result = evaluateRisk(admin.data, { ...stats, metrics }, String(a.market_category).replace("INDIAN", "INDIA"), signal);
        if (!result.allowed && result.haltUntil && !result.reason?.includes("unavailable")) {
          await manager.query(`UPDATE user_trading_accounts SET account_meta=COALESCE(account_meta,'{}'::jsonb)||jsonb_build_object('riskHalt',$2::jsonb) WHERE id=$1`, [id, JSON.stringify({ reason: result.reason, until: result.haltUntil, rulesUpdatedAt: JSON.stringify(rules) })]);
        }
        if (result.allowed && signal.id) await manager.query(`UPDATE trade_signals SET risk_reserved_at=NOW() WHERE id=$1`, [signal.id]);
        return result;
      });
      if (!result.allowed) return this.reject(signal, result.reason ?? "risk_limit");
      return result;
    } catch (error) {
      console.error("[RISK] validation failed", { accountId: id, signalId: signal.id, error });
      return this.reject(signal, "risk_validation_unavailable");
    }
  }

  private async reject(signal: any, reason: string): Promise<TradeCheckResult> {
    if (signal.id) await AppDataSource.query(`UPDATE trade_signals_status SET status=$2, last_error=$3, next_retry_at=NULL, updated_at=NOW() WHERE signal_id=$1`, [signal.id, RISK_REJECTED, reason]);
    console.warn("[RISK] trade rejected", { signalId: signal.id, accountId: signal.tradingAccountId, reason });
    return { allowed: false, reason };
  }
}
