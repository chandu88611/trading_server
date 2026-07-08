import { MarketType } from "../../../../types/trade-identify";

export type TradeExecutionMode = "OPEN" | "AMEND_SLTP";
export type StrategyOrderType =
  | "MARKET"
  | "LIMIT"
  | "STOP"
  | "STOP_LIMIT"
  | "MARKET_RANGE";
export type StopLossTriggerMethod =
  | "TRADE"
  | "OPPOSITE"
  | "DOUBLE_TRADE"
  | "DOUBLE_OPPOSITE";

// ── Indian-market instrument classification (explicit, not inferred) ──
export type IndianInstrumentType = "EQUITY" | "FUTURES" | "OPTIONS";
export type IndianProduct = "INTRADAY" | "DELIVERY" | "MARGIN" | "MIS" | "NRML" | "I" | "C" | "M";
export type IndianOptionType = "CE" | "PE";

export type IndianInstrumentFields = {
  instrumentType?: IndianInstrumentType | null;
  product?: IndianProduct | null;
  underlying?: string | null;        // e.g. NIFTY / BANKNIFTY / RELIANCE
  expiry?: string | null;            // ISO date "2024-03-28" (F&O)
  optionType?: IndianOptionType | null; // OPTIONS only
  strike?: number | null;            // OPTIONS only
  tradingSymbol?: string | null;     // explicit broker tsym (overrides builder)
  sourceAction?: string | null;
  brokerInstrumentId?: number | null;
  instrumentToken?: string | null;
  tickSize?: number | null;
};

export type StrategyExecutionFields = IndianInstrumentFields & {
  executionMode?: TradeExecutionMode;
  entryRef?: string | null;
  orderType?: StrategyOrderType | null;
  limitPrice?: number | null;
  stopPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  // Strategy alerts send these as logical broker distance units (e.g. 7, 10).
  // The backend converts them internally into broker-native price distances
  // before sending to cTrader or MT5.
  stopLossDistance?: number | null;
  takeProfitDistance?: number | null;
  stopLossAmount?: number | null;
  takeProfitAmount?: number | null;
  trailingStopLoss?: boolean | null;
  guaranteedStopLoss?: boolean | null;
  stopLossTriggerMethod?: StopLossTriggerMethod | null;
  trailingTakeProfitActivationDistance?: number | null;
  trailingTakeProfitDistance?: number | null;
  breakEvenActivationDistance?: number | null;
  breakEvenOffsetDistance?: number | null;
  trailingStopLossDistance?: number | null;
};

export interface ICreateAlertSnapshot extends StrategyExecutionFields {
  userId: number;
  adminStrategyTradeId?: number | null;
  strategyId?: number | null;
  subscriptionId?: number | null;
  planId?: number | null;
  tokenType?: "access" | "webhook";
  tradingStrength?: number | null;
  market: MarketType;
  ticker: string;
  exchange: string;
  interval: string;
  barTime: Date;
  alertTime: Date;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  currency?: string | null;
  baseCurrency?: string | null;
  action?: TradeAction;
  lots?: number | null;
  strategy?: string | null;
}

export type ICreateStrategyManagedAlert = Omit<
  ICreateAlertSnapshot,
  "userId" | "adminStrategyTradeId" | "strategyId" | "subscriptionId" | "planId" | "tokenType"
>;

export enum TradeAction{
  SELL = "SELL",
  BUY = "BUY",
  HOLD = "HOLD"
}

export type HistoryQuery = {
  page: number;
  limit: number;
  ticker?: string;
  exchange?: string;
  interval?: string;
  from?: string;        // ISO date
  to?: string;          // ISO date
  lastMinutes?: number; // alternative to from/to
};

export type AdminHistoryQuery = HistoryQuery & {
  userId?: number;
  planId?: number;
};

export type TimelineQuery = {
  bucket: "1m" | "5m" | "15m" | "1h" | "1d";
  ticker?: string;
  exchange?: string;
  interval?: string;
  jobId?: number;
  from?: string;
  to?: string;
  lastMinutes?: number;
};


export type TimelineBucket = "1m" | "5m" | "15m" | "1h" | "1d";

export function parseTimelineBucket(v: unknown): TimelineBucket {
  const s = String(v ?? "").trim();

  switch (s) {
    case "1m":
    case "5m":
    case "15m":
    case "1h":
    case "1d":
      return s; 
    default:
      return "15m";
  }
}
