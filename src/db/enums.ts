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
  action: string;
  symbol: string;
  price: string | number;
  exchange: string;
  assetType: string;
  signalTime: string;
  userId: number; 
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