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
