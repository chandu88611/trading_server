export enum UserRoleEnum {
  USER = "USER",
  MASTER = "MASTER",
  ADMIN = "ADMIN",
}

export enum PlanBillingCycleEnum {
  MONTHLY = "MONTHLY",
  YEARLY = "YEARLY",
}

export enum SubscriptionStatusEnum {
  ACTIVE = "ACTIVE",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
  PAUSED = "PAUSED",
}

export enum AddressTypeEnum {
  REGISTERED = "REGISTERED",
  CORPORATE = "CORPORATE",
  BILLING = "BILLING",
  BRANCH = "BRANCH",
  WAREHOUSE = "WAREHOUSE",
  OTHER = "OTHER",
}

export enum CopyTradeSideEnum {
  BUY = "BUY",
  SELL = "SELL",
}

export type ClaimedSignal = {
  id: number;
  jobId: number;
  tradingAccountId: number;
  accountId: number;
  env?: "demo" | "live";
  accessToken: string;
  refreshToken?: string;
  action: string;
  symbol: string;
  price: string | number;
  volume?: string | number | null;
  exchange: string;
  assetType: string;
  signalTime: string;
  userId: number;
  executionMode?: "OPEN" | "AMEND_SLTP" | null;
  entryRef?: string | null;
  orderType?: string | null;
  limitPrice?: string | number | null;
  stopPrice?: string | number | null;
  stopLoss?: string | number | null;
  takeProfit?: string | number | null;
  stopLossDistance?: string | number | null;
  takeProfitDistance?: string | number | null;
  stopLossAmount?: string | number | null;
  takeProfitAmount?: string | number | null;
  trailingStopLoss?: boolean | null;
  guaranteedStopLoss?: boolean | null;
  stopLossTriggerMethod?: string | null;
  trailingTakeProfitActivationDistance?: string | number | null;
  trailingTakeProfitDistance?: string | number | null;
  breakEvenActivationDistance?: string | number | null;
  breakEvenOffsetDistance?: string | number | null;
  trailingStopLossDistance?: string | number | null;
  brokerOrderId?: string | number | null;
  brokerPositionId?: string | number | null;
};

export type OAuthExchangeResult = {
  ok: boolean;
  url: string;
  status?: number;
  latencyMs: number;
  payload?: any;
  error?: string;
};

export enum UserTradeType{
  MT5 = "MT5",
  CTRADER = "CTRADER",
}

export enum marketDataProviderEnum {
  FOREX = "FOREX",
  CRYPTO = "CRYPTO",
  INDIAN = "INDIAN",
}

export enum TradingCategory {
  FOREX = "FOREX",
  CRYPTO = "CRYPTO",
  INDEX = "INDEX",
  COMMODITY = "COMMODITY",
  STOCK = "STOCK",
  FUTURES = "FUTURES"
}
