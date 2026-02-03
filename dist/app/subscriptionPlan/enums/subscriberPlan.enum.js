"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketCode = exports.PlanTypeCode = exports.SubscriptionStatus = exports.BillingInterval = exports.TradingAccountStatus = exports.UserStrategyStatus = exports.ExecutionFlow = exports.MarketCategory = void 0;
var MarketCategory;
(function (MarketCategory) {
    MarketCategory["FOREX"] = "FOREX";
    MarketCategory["CRYPTO"] = "CRYPTO";
    MarketCategory["INDIA"] = "INDIA";
})(MarketCategory || (exports.MarketCategory = MarketCategory = {}));
var ExecutionFlow;
(function (ExecutionFlow) {
    ExecutionFlow["PINE_CONNECTOR"] = "PINE_CONNECTOR";
    ExecutionFlow["MANAGED"] = "MANAGED";
    ExecutionFlow["API"] = "API";
    ExecutionFlow["DIRECT"] = "direct";
})(ExecutionFlow || (exports.ExecutionFlow = ExecutionFlow = {}));
var UserStrategyStatus;
(function (UserStrategyStatus) {
    UserStrategyStatus["ACTIVE"] = "active";
    UserStrategyStatus["PAUSED"] = "paused";
    UserStrategyStatus["STOPPED"] = "stopped";
})(UserStrategyStatus || (exports.UserStrategyStatus = UserStrategyStatus = {}));
var TradingAccountStatus;
(function (TradingAccountStatus) {
    TradingAccountStatus["PENDING"] = "pending";
    TradingAccountStatus["VERIFIED"] = "verified";
    TradingAccountStatus["BLOCKED"] = "blocked";
})(TradingAccountStatus || (exports.TradingAccountStatus = TradingAccountStatus = {}));
// src/app/subscriptionPlan/enums/subscriberPlan.enum.ts
var BillingInterval;
(function (BillingInterval) {
    BillingInterval["MONTHLY"] = "monthly";
    BillingInterval["YEARLY"] = "yearly";
    BillingInterval["LIFETIME"] = "lifetime";
})(BillingInterval || (exports.BillingInterval = BillingInterval = {}));
var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus["TRIALING"] = "trialing";
    SubscriptionStatus["ACTIVE"] = "active";
    SubscriptionStatus["PAST_DUE"] = "past_due";
    SubscriptionStatus["LIQUIDATE_ONLY"] = "liquidate_only";
    SubscriptionStatus["PAUSED"] = "paused";
    SubscriptionStatus["CANCELED"] = "canceled";
    SubscriptionStatus["EXPIRED"] = "expired";
})(SubscriptionStatus || (exports.SubscriptionStatus = SubscriptionStatus = {}));
var PlanTypeCode;
(function (PlanTypeCode) {
    PlanTypeCode["STRATEGY"] = "STRATEGY";
    PlanTypeCode["SELF_TRADE"] = "SELF_TRADE";
    PlanTypeCode["COPY_TRADER"] = "COPY_TRADER";
    PlanTypeCode["MASTER"] = "MASTER";
    PlanTypeCode["BUNDLE"] = "BUNDLE";
})(PlanTypeCode || (exports.PlanTypeCode = PlanTypeCode = {}));
var MarketCode;
(function (MarketCode) {
    MarketCode["FOREX"] = "FOREX";
    MarketCode["CRYPTO"] = "CRYPTO";
    MarketCode["INDIAN"] = "INDIAN";
})(MarketCode || (exports.MarketCode = MarketCode = {}));
