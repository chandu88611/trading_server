// src/app/subscriptionPlan/interfaces/subscriberPlan.interface.ts
import { BillingInterval, ExecutionFlow, MarketCategory } from "../enums/subscriberPlan.enum";

export interface ICreateSubscriptionPlan {
  planCode: string;
  name: string;
  description?: string | null;

  priceCents: number;
  currency?: string;
  interval: BillingInterval;

  category: MarketCategory;
  executionFlow: ExecutionFlow;

  maxActiveStrategies?: number;
  maxConnectedAccounts?: number;
  maxDailyTrades?: number | null;
  maxLotPerTrade?: number | null;

  featureFlags?: Record<string, any> | null;
  isActive?: boolean;

  metadata?: Record<string, any> | null;
}

export interface IUpdateSubscriptionPlan {
  name?: string;
  description?: string | null;

  priceCents?: number;
  currency?: string;
  interval?: BillingInterval;

  category?: MarketCategory;
  executionFlow?: ExecutionFlow;

  maxActiveStrategies?: number;
  maxConnectedAccounts?: number;
  maxDailyTrades?: number | null;
  maxLotPerTrade?: number | null;

  featureFlags?: Record<string, any> | null;
  isActive?: boolean;

  metadata?: Record<string, any> | null;
}

export interface IQueryPlans {
  chunkSize?: number;
  initialOffset?: number;
  searchParam?: string;

  category?: MarketCategory;
  executionFlow?: ExecutionFlow;
  isActive?: boolean;
}
