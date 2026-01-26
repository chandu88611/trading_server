export enum MarketCategory {
  FOREX = "FOREX",
  CRYPTO = "CRYPTO",
  INDIA = "INDIA",
}

export enum ExecutionFlow {
  PINE_CONNECTOR = "PINE_CONNECTOR",
  MANAGED = "MANAGED",
  API = "API",
}

 

export enum UserStrategyStatus {
  ACTIVE = "active",
  PAUSED = "paused",
  STOPPED = "stopped",
}

export enum TradingAccountStatus {
  PENDING = "pending",
  VERIFIED = "verified",
  BLOCKED = "blocked",
}


// src/app/subscriptionPlan/enums/subscriberPlan.enum.ts

export enum BillingInterval {
  MONTHLY = "monthly",
  YEARLY = "yearly",
  LIFETIME = "lifetime",
}

export enum SubscriptionStatus {
  TRIALING = "trialing",
  ACTIVE = "active",
  PAST_DUE = "past_due",
  LIQUIDATE_ONLY = "liquidate_only",
  PAUSED = "paused",
  CANCELED = "canceled",
  EXPIRED = "expired",
}

export enum PlanTypeCode {
  STRATEGY = "STRATEGY",
  SELF_TRADE = "SELF_TRADE",
  COPY_TRADER = "COPY_TRADER",
  MASTER = "MASTER",
  BUNDLE = "BUNDLE",
}

export enum MarketCode {
  FOREX = "FOREX",
  CRYPTO = "CRYPTO",
  INDIAN = "INDIAN",
}
