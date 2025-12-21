export interface ICreateAlertSnapshot {
  userId: number;
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
  action: TradeAction;
}

export enum TradeAction{
  SELL = "SELL",
  BUY = "BUY",
  HOLD = "HOLD"
}

// export interface ICreateAlertSnapshot {
//   jobId: number;
//   ticker: string;
//   exchange?: string | null;
//   interval?: string | null;
//   barTime?: Date | null;
//   alertTime?: Date | null;
//   open?: number | null;
//   close?: number | null;
//   high?: number | null;
//   low?: number | null;
//   volume?: number | null;
//   currency?: string | null;
//   baseCurrency?: string | null;
// }



export type HistoryQuery = {
  page: number;
  limit: number;
  ticker?: string;
  exchange?: string;
  interval?: string;
  jobId?: number;
  from?: string;        // ISO date
  to?: string;          // ISO date
  lastMinutes?: number; // alternative to from/to
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
