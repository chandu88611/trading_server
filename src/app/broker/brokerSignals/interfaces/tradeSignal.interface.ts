import { TradingCategory } from "../../../../db/enums";
import {
  StopLossTriggerMethod,
  StrategyOrderType,
  TradeExecutionMode,
  IndianInstrumentFields,
} from "../../brokerAlerts/interfaces/alertSnapshot.interface";

export interface ICreateTradeSignal extends IndianInstrumentFields {
  userId: number;
  tradingAccountId: number;
  alertSnapshotsId: number;
  adminStrategyTradeId?: number | null;
  strategyId?: number | null;
  planId?: number | null;
  subscriptionId?: number | null;
  action: string;
  symbol: string;
  price: number;
  exchange: string;
  volume: number;
  assetType: TradingCategory;
  signalTime: Date;
  executionMode?: TradeExecutionMode | null;
  entryRef?: string | null;
  orderType?: StrategyOrderType | null;
  limitPrice?: number | null;
  stopPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
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
  brokerOrderId?: string | number | null;
  brokerPositionId?: string | number | null;
}
