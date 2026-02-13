import { TradingCategory } from "../../../../db/enums";

export interface ICreateTradeSignal {
  userId: number;
  tradingAccountId: number;
  alertSnapshotsId: number;
  action: string;
  symbol: string;
  price: number;
  exchange: string;
  volume: number;
  assetType: TradingCategory;
  signalTime: Date;
}
