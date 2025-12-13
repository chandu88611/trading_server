export interface ICreateTradeSignal {
  jobId: number;
  action: string;
  symbol: string;
  price: number;
  exchange: string;
  signalTime: Date;
}
