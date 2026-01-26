// src/app/subscriptionPlan/interfaces/subscriberPlan.interface.ts
import { BillingInterval, MarketCode, PlanTypeCode } from "../enums/subscriberPlan.enum";

export type FeatureKV = Record<string, string>;

export interface ICreateSubscriptionPlan {
  // subscription_plans
  name: string;
  description?: string | null;
  isActive?: boolean;
  metadata?: Record<string, any>;

  // plan_types / markets lookup by code
  planTypeCode: PlanTypeCode;
  marketCode?: MarketCode | null; // nullable allowed

  // plan_pricing (optional, but usually exists)
  pricing?: {
    priceInr: number;
    currency?: string;
    interval?: BillingInterval;
    isFree?: boolean;
  };

  // plan_limits (optional)
  limits?: {
    minBalance?: number | null;
    maxTradesPerWeek?: number | null;
    maxConnectedAccounts?: number | null;
    maxDailyTrades?: number | null;
    maxLotPerTrade?: number | null;
    maxCopyMasters?: number | null;
    maxCopyFollowingAccounts?: number | null;
    maxCopyFollowersPerMaster?: number | null;
  };

  // plan_features (optional)
  features?: FeatureKV; // { "WEBHOOK_EXECUTION": "ENABLED" }

  // plan_strategies (optional)
  strategyIds?: number[]; // map to strategies table

  // plan_bundle_items (optional)
  bundleItems?: { includedPlanId: string; quantity?: number }[]; // includedPlanId is UUID
}

export interface IUpdateSubscriptionPlan {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  metadata?: Record<string, any>;

  planTypeCode?: PlanTypeCode;
  marketCode?: MarketCode | null;

  pricing?: {
    priceInr?: number;
    currency?: string;
    interval?: BillingInterval;
    isFree?: boolean;
  };

  limits?: {
    minBalance?: number | null;
    maxTradesPerWeek?: number | null;
    maxConnectedAccounts?: number | null;
    maxDailyTrades?: number | null;
    maxLotPerTrade?: number | null;
    maxCopyMasters?: number | null;
    maxCopyFollowingAccounts?: number | null;
    maxCopyFollowersPerMaster?: number | null;
  };

  // replace-all behavior
  features?: FeatureKV | null;      // null => clear all features
  strategyIds?: number[] | null;    // null => clear all strategies
  bundleItems?: { includedPlanId: string; quantity?: number }[] | null; // null => clear bundle items
}

export interface IQueryPlans {
  chunkSize?: number;
  initialOffset?: number;

  searchParam?: string;
  isActive?: boolean;

  planTypeCode?: PlanTypeCode;
  marketCode?: MarketCode | "NULL"; // allow filtering non-market plans (NULL)
}
