export interface ICreateAlertSnapshot {
  jobId: number;
  ticker: string;
  exchange?: string | null;
  interval?: string | null;
  barTime?: Date | null;
  alertTime?: Date | null;
  open?: number | null;
  close?: number | null;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
  currency?: string | null;
  baseCurrency?: string | null;
}
