"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeSignal = exports.AlertSnapshot = exports.BrokerTradingAccountDetails = exports.BrokerSession = exports.BrokerCredential = exports.CopyRelationship = exports.MasterProfile = exports.UserBillingDetails = exports.UserTradingAccountDetails = exports.RazorpayOrder = exports.SubscriptionPayment = exports.SubscriptionInvoice = exports.UserSubscription = exports.BundlePlan = exports.PlanStrategy = exports.StrategyDetails = exports.Strategy = exports.PlanPricing = exports.PlanLimits = exports.PlanFeature = exports.Plan = exports.Market = exports.PlanType = exports.AuthProvider = exports.RefreshToken = exports.User = void 0;
const typeorm_1 = require("typeorm");
const enums_1 = require("../db/enums");
class IdBase {
}
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("increment", { type: "bigint" }),
    __metadata("design:type", Number)
], IdBase.prototype, "id", void 0);
class TimeStampedBase extends IdBase {
}
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamptz", name: "created_at" }),
    __metadata("design:type", Date)
], TimeStampedBase.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamptz", name: "updated_at" }),
    __metadata("design:type", Date)
], TimeStampedBase.prototype, "updatedAt", void 0);
let User = class User extends TimeStampedBase {
};
exports.User = User;
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "password_hash", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "passwordHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", name: "is_email_verified", default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "isEmailVerified", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", name: "is_active", default: true }),
    __metadata("design:type", Boolean)
], User.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", name: "is_admin", default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "isAdmin", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "verification_token", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "verificationToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "reset_token", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "resetToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", name: "reset_token_expires_at", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "resetTokenExpiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "failed_login_attempts", default: 0 }),
    __metadata("design:type", Number)
], User.prototype, "failedLoginAttempts", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", name: "locked_at", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "lockedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", name: "mfa_enabled", default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "mfaEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "mfa_method", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "mfaMethod", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "mfa_secret", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "mfaSecret", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", name: "recovery_codes", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "recoveryCodes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", name: "last_login_at", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "lastLoginAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "inet", name: "last_login_ip", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "lastLoginIp", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "last_login_user_agent", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "lastLoginUserAgent", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", name: "deleted_at", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", name: "allow_trade", default: true }),
    __metadata("design:type", Boolean)
], User.prototype, "allowTrade", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", name: "allow_copy_trade", default: true }),
    __metadata("design:type", Boolean)
], User.prototype, "allowCopyTrade", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => RefreshToken, (t) => t.user),
    __metadata("design:type", Array)
], User.prototype, "refreshTokens", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => AuthProvider, (a) => a.user),
    __metadata("design:type", Array)
], User.prototype, "authProviders", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => UserSubscription, (s) => s.user),
    __metadata("design:type", Array)
], User.prototype, "subscriptions", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => SubscriptionInvoice, (i) => i.user),
    __metadata("design:type", Array)
], User.prototype, "invoices", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => SubscriptionPayment, (p) => p.user),
    __metadata("design:type", Array)
], User.prototype, "payments", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => RazorpayOrder, (r) => r.user),
    __metadata("design:type", Array)
], User.prototype, "razorpayOrders", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => UserTradingAccountDetails, (a) => a.user),
    __metadata("design:type", Array)
], User.prototype, "tradingAccounts", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => UserBillingDetails, (b) => b.user),
    __metadata("design:type", Object)
], User.prototype, "billingDetails", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => MasterProfile, (m) => m.user),
    __metadata("design:type", Object)
], User.prototype, "masterProfile", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => CopyRelationship, (cr) => cr.follower),
    __metadata("design:type", Array)
], User.prototype, "followingMasters", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => AlertSnapshot, (a) => a.user),
    __metadata("design:type", Array)
], User.prototype, "alertSnapshots", void 0);
exports.User = User = __decorate([
    (0, typeorm_1.Entity)({ name: "users" }),
    (0, typeorm_1.Index)("ix_users_deleted_at", ["deletedAt"]),
    (0, typeorm_1.Index)("ix_users_last_login_at", ["lastLoginAt"])
], User);
let RefreshToken = class RefreshToken extends IdBase {
};
exports.RefreshToken = RefreshToken;
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "user_id" }),
    __metadata("design:type", Number)
], RefreshToken.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User, (u) => u.refreshTokens, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", User)
], RefreshToken.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "token_hash" }),
    __metadata("design:type", String)
], RefreshToken.prototype, "tokenHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", name: "expires_at" }),
    __metadata("design:type", Date)
], RefreshToken.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], RefreshToken.prototype, "revoked", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamptz", name: "created_at" }),
    __metadata("design:type", Date)
], RefreshToken.prototype, "createdAt", void 0);
exports.RefreshToken = RefreshToken = __decorate([
    (0, typeorm_1.Entity)({ name: "user_refresh_tokens" }),
    (0, typeorm_1.Index)("uq_user_refresh_tokens_token_hash", ["tokenHash"], { unique: true }),
    (0, typeorm_1.Index)("ix_user_refresh_tokens_user_id", ["userId"]),
    (0, typeorm_1.Index)("ix_user_refresh_tokens_expires_at", ["expiresAt"])
], RefreshToken);
let AuthProvider = class AuthProvider extends IdBase {
};
exports.AuthProvider = AuthProvider;
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "user_id" }),
    __metadata("design:type", Number)
], AuthProvider.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User, (u) => u.authProviders, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", User)
], AuthProvider.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], AuthProvider.prototype, "provider", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "provider_user_id", nullable: true }),
    __metadata("design:type", Object)
], AuthProvider.prototype, "providerUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", name: "provider_meta", nullable: true }),
    __metadata("design:type", Object)
], AuthProvider.prototype, "providerMeta", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamptz", name: "created_at" }),
    __metadata("design:type", Date)
], AuthProvider.prototype, "createdAt", void 0);
exports.AuthProvider = AuthProvider = __decorate([
    (0, typeorm_1.Entity)({ name: "auth_providers" }),
    (0, typeorm_1.Index)("ix_auth_providers_user_id", ["userId"]),
    (0, typeorm_1.Index)("uq_auth_providers_user_provider", ["userId", "provider"], { unique: true })
], AuthProvider);
let PlanType = class PlanType extends IdBase {
};
exports.PlanType = PlanType;
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], PlanType.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], PlanType.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamptz", name: "created_at" }),
    __metadata("design:type", Date)
], PlanType.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Plan, (p) => p.planType),
    __metadata("design:type", Array)
], PlanType.prototype, "plans", void 0);
exports.PlanType = PlanType = __decorate([
    (0, typeorm_1.Entity)({ name: "plan_types" }),
    (0, typeorm_1.Index)("uq_plan_types_code", ["code"], { unique: true })
], PlanType);
let Market = class Market extends IdBase {
};
exports.Market = Market;
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Market.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Market.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamptz", name: "created_at" }),
    __metadata("design:type", Date)
], Market.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Plan, (p) => p.market),
    __metadata("design:type", Array)
], Market.prototype, "plans", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Strategy, (s) => s.market),
    __metadata("design:type", Array)
], Market.prototype, "strategies", void 0);
exports.Market = Market = __decorate([
    (0, typeorm_1.Entity)({ name: "markets" }),
    (0, typeorm_1.Index)("uq_markets_code", ["code"], { unique: true })
], Market);
let Plan = class Plan extends TimeStampedBase {
};
exports.Plan = Plan;
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "plan_type_id" }),
    __metadata("design:type", Number)
], Plan.prototype, "planTypeId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => PlanType, (pt) => pt.plans, { onDelete: "RESTRICT" }),
    (0, typeorm_1.JoinColumn)({ name: "plan_type_id" }),
    __metadata("design:type", PlanType)
], Plan.prototype, "planType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "market_id" }),
    __metadata("design:type", Number)
], Plan.prototype, "marketId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Market, (m) => m.plans, { onDelete: "RESTRICT" }),
    (0, typeorm_1.JoinColumn)({ name: "market_id" }),
    __metadata("design:type", Market)
], Plan.prototype, "market", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Plan.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], Plan.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", name: "is_active", default: true }),
    __metadata("design:type", Boolean)
], Plan.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], Plan.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => PlanFeature, (f) => f.plan),
    __metadata("design:type", Array)
], Plan.prototype, "features", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => PlanLimits, (l) => l.plan),
    __metadata("design:type", Object)
], Plan.prototype, "limits", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => PlanPricing, (pp) => pp.plan),
    __metadata("design:type", Array)
], Plan.prototype, "pricing", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => UserSubscription, (s) => s.plan),
    __metadata("design:type", Array)
], Plan.prototype, "subscriptions", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => PlanStrategy, (ps) => ps.plan),
    __metadata("design:type", Array)
], Plan.prototype, "planStrategies", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => BundlePlan, (bp) => bp.bundlePlan),
    __metadata("design:type", Array)
], Plan.prototype, "bundleIncludes", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => BundlePlan, (bp) => bp.includedPlan),
    __metadata("design:type", Array)
], Plan.prototype, "includedInBundles", void 0);
exports.Plan = Plan = __decorate([
    (0, typeorm_1.Entity)({ name: "plans" }),
    (0, typeorm_1.Index)("ix_plans_plan_type_id", ["planTypeId"]),
    (0, typeorm_1.Index)("ix_plans_market_id", ["marketId"]),
    (0, typeorm_1.Index)("ix_plans_is_active", ["isActive"])
], Plan);
let PlanFeature = class PlanFeature extends TimeStampedBase {
};
exports.PlanFeature = PlanFeature;
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "plan_id" }),
    __metadata("design:type", Number)
], PlanFeature.prototype, "planId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Plan, (p) => p.features, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "plan_id" }),
    __metadata("design:type", Plan)
], PlanFeature.prototype, "plan", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "feature_key" }),
    __metadata("design:type", String)
], PlanFeature.prototype, "featureKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "feature_value", nullable: true }),
    __metadata("design:type", Object)
], PlanFeature.prototype, "featureValue", void 0);
exports.PlanFeature = PlanFeature = __decorate([
    (0, typeorm_1.Entity)({ name: "plan_features" }),
    (0, typeorm_1.Index)("uq_plan_features_plan_key", ["planId", "featureKey"], { unique: true }),
    (0, typeorm_1.Index)("ix_plan_features_plan_id", ["planId"])
], PlanFeature);
let PlanLimits = class PlanLimits extends TimeStampedBase {
};
exports.PlanLimits = PlanLimits;
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "plan_id" }),
    __metadata("design:type", Number)
], PlanLimits.prototype, "planId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => Plan, (p) => p.limits, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "plan_id" }),
    __metadata("design:type", Plan)
], PlanLimits.prototype, "plan", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 18, scale: 2, name: "min_balance", nullable: true }),
    __metadata("design:type", Object)
], PlanLimits.prototype, "minBalance", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "max_connected_accounts", nullable: true }),
    __metadata("design:type", Object)
], PlanLimits.prototype, "maxConnectedAccounts", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "max_trades_per_week", nullable: true }),
    __metadata("design:type", Object)
], PlanLimits.prototype, "maxTradesPerWeek", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 18, scale: 2, name: "max_daily_trade", nullable: true }),
    __metadata("design:type", Object)
], PlanLimits.prototype, "maxDailyTrade", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 18, scale: 4, name: "max_lot_per_trade", nullable: true }),
    __metadata("design:type", Object)
], PlanLimits.prototype, "maxLotPerTrade", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "max_copy_following_accounts", nullable: true }),
    __metadata("design:type", Object)
], PlanLimits.prototype, "maxCopyFollowingAccounts", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], PlanLimits.prototype, "metadata", void 0);
exports.PlanLimits = PlanLimits = __decorate([
    (0, typeorm_1.Entity)({ name: "plan_limits" }),
    (0, typeorm_1.Index)("uq_plan_limits_plan", ["planId"], { unique: true }),
    (0, typeorm_1.Index)("ix_plan_limits_plan_id", ["planId"])
], PlanLimits);
let PlanPricing = class PlanPricing extends TimeStampedBase {
};
exports.PlanPricing = PlanPricing;
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "plan_id" }),
    __metadata("design:type", Number)
], PlanPricing.prototype, "planId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Plan, (p) => p.pricing, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "plan_id" }),
    __metadata("design:type", Plan)
], PlanPricing.prototype, "plan", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 18, scale: 2, name: "plan_inr", nullable: true }),
    __metadata("design:type", Object)
], PlanPricing.prototype, "planInr", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], PlanPricing.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: enums_1.PlanBillingCycleEnum, name: "billing_cycle" }),
    __metadata("design:type", String)
], PlanPricing.prototype, "billingCycle", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", name: "is_free", default: false }),
    __metadata("design:type", Boolean)
], PlanPricing.prototype, "isFree", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], PlanPricing.prototype, "metadata", void 0);
exports.PlanPricing = PlanPricing = __decorate([
    (0, typeorm_1.Entity)({ name: "plan_pricing" }),
    (0, typeorm_1.Index)("uq_plan_pricing_plan_cycle", ["planId", "billingCycle"], { unique: true }),
    (0, typeorm_1.Index)("ix_plan_pricing_plan_id", ["planId"]),
    (0, typeorm_1.Index)("ix_plan_pricing_cycle", ["billingCycle"])
], PlanPricing);
let Strategy = class Strategy extends TimeStampedBase {
};
exports.Strategy = Strategy;
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "market_id" }),
    __metadata("design:type", Number)
], Strategy.prototype, "marketId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Market, (m) => m.strategies, { onDelete: "RESTRICT" }),
    (0, typeorm_1.JoinColumn)({ name: "market_id" }),
    __metadata("design:type", Market)
], Strategy.prototype, "market", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Strategy.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 10, scale: 2, name: "avg_return_min", nullable: true }),
    __metadata("design:type", Object)
], Strategy.prototype, "avgReturnMin", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 10, scale: 2, name: "avg_return_max", nullable: true }),
    __metadata("design:type", Object)
], Strategy.prototype, "avgReturnMax", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "active_users", nullable: true }),
    __metadata("design:type", Object)
], Strategy.prototype, "activeUsers", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], Strategy.prototype, "provider", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => StrategyDetails, (d) => d.strategy),
    __metadata("design:type", Object)
], Strategy.prototype, "details", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => PlanStrategy, (ps) => ps.strategy),
    __metadata("design:type", Array)
], Strategy.prototype, "planStrategies", void 0);
exports.Strategy = Strategy = __decorate([
    (0, typeorm_1.Entity)({ name: "strategies" }),
    (0, typeorm_1.Index)("ix_strategies_market_id", ["marketId"]),
    (0, typeorm_1.Index)("ix_strategies_provider", ["provider"])
], Strategy);
let StrategyDetails = class StrategyDetails extends TimeStampedBase {
};
exports.StrategyDetails = StrategyDetails;
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "strategie_id" }),
    __metadata("design:type", Number)
], StrategyDetails.prototype, "strategieId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => Strategy, (s) => s.details, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "strategie_id" }),
    __metadata("design:type", Strategy)
], StrategyDetails.prototype, "strategy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], StrategyDetails.prototype, "metadata", void 0);
exports.StrategyDetails = StrategyDetails = __decorate([
    (0, typeorm_1.Entity)({ name: "strategies_details" }),
    (0, typeorm_1.Index)("uq_strategies_details_strat", ["strategieId"], { unique: true }),
    (0, typeorm_1.Index)("ix_strategies_details_strat_id", ["strategieId"])
], StrategyDetails);
let PlanStrategy = class PlanStrategy extends TimeStampedBase {
};
exports.PlanStrategy = PlanStrategy;
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "plan_id" }),
    __metadata("design:type", Number)
], PlanStrategy.prototype, "planId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Plan, (p) => p.planStrategies, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "plan_id" }),
    __metadata("design:type", Plan)
], PlanStrategy.prototype, "plan", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "strategie_id" }),
    __metadata("design:type", Number)
], PlanStrategy.prototype, "strategieId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Strategy, (s) => s.planStrategies, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "strategie_id" }),
    __metadata("design:type", Strategy)
], PlanStrategy.prototype, "strategy", void 0);
exports.PlanStrategy = PlanStrategy = __decorate([
    (0, typeorm_1.Entity)({ name: "plan_strategie" }),
    (0, typeorm_1.Index)("uq_plan_strategie", ["planId", "strategieId"], { unique: true }),
    (0, typeorm_1.Index)("ix_plan_strategie_plan_id", ["planId"]),
    (0, typeorm_1.Index)("ix_plan_strategie_strat_id", ["strategieId"])
], PlanStrategy);
let BundlePlan = class BundlePlan extends TimeStampedBase {
};
exports.BundlePlan = BundlePlan;
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "bundle_plan_id" }),
    __metadata("design:type", Number)
], BundlePlan.prototype, "bundlePlanId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Plan, (p) => p.bundleIncludes, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "bundle_plan_id" }),
    __metadata("design:type", Plan)
], BundlePlan.prototype, "bundlePlan", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "included_plan_id" }),
    __metadata("design:type", Number)
], BundlePlan.prototype, "includedPlanId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Plan, (p) => p.includedInBundles, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "included_plan_id" }),
    __metadata("design:type", Plan)
], BundlePlan.prototype, "includedPlan", void 0);
exports.BundlePlan = BundlePlan = __decorate([
    (0, typeorm_1.Entity)({ name: "bundle_plans" }),
    (0, typeorm_1.Index)("uq_bundle_plans", ["bundlePlanId", "includedPlanId"], { unique: true }),
    (0, typeorm_1.Index)("ix_bundle_plans_bundle", ["bundlePlanId"]),
    (0, typeorm_1.Index)("ix_bundle_plans_included", ["includedPlanId"])
], BundlePlan);
let UserSubscription = class UserSubscription extends TimeStampedBase {
};
exports.UserSubscription = UserSubscription;
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "plan_id" }),
    __metadata("design:type", Number)
], UserSubscription.prototype, "planId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Plan, (p) => p.subscriptions, { onDelete: "RESTRICT" }),
    (0, typeorm_1.JoinColumn)({ name: "plan_id" }),
    __metadata("design:type", Plan)
], UserSubscription.prototype, "plan", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "user_id" }),
    __metadata("design:type", Number)
], UserSubscription.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User, (u) => u.subscriptions, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", User)
], UserSubscription.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: enums_1.SubscriptionStatusEnum, default: enums_1.SubscriptionStatusEnum.ACTIVE }),
    __metadata("design:type", String)
], UserSubscription.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "date", name: "start_data", nullable: true }),
    __metadata("design:type", Object)
], UserSubscription.prototype, "startDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "date", name: "end_date", nullable: true }),
    __metadata("design:type", Object)
], UserSubscription.prototype, "endDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", name: "is_priority", default: false }),
    __metadata("design:type", Boolean)
], UserSubscription.prototype, "isPriority", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", name: "is_expired", default: false }),
    __metadata("design:type", Boolean)
], UserSubscription.prototype, "isExpired", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", name: "is_canceled", default: false }),
    __metadata("design:type", Boolean)
], UserSubscription.prototype, "isCanceled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", name: "canceled_at", nullable: true }),
    __metadata("design:type", Object)
], UserSubscription.prototype, "canceledAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => SubscriptionInvoice, (i) => i.subscription),
    __metadata("design:type", Array)
], UserSubscription.prototype, "invoices", void 0);
exports.UserSubscription = UserSubscription = __decorate([
    (0, typeorm_1.Entity)({ name: "user_subscriptions" }),
    (0, typeorm_1.Index)("ix_user_subscriptions_user_id", ["userId"]),
    (0, typeorm_1.Index)("ix_user_subscriptions_plan_id", ["planId"]),
    (0, typeorm_1.Index)("ix_user_subscriptions_status", ["status"]),
    (0, typeorm_1.Index)("ix_user_subscriptions_user_status", ["userId", "status"])
], UserSubscription);
let SubscriptionInvoice = class SubscriptionInvoice extends TimeStampedBase {
};
exports.SubscriptionInvoice = SubscriptionInvoice;
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "subscription_id" }),
    __metadata("design:type", Number)
], SubscriptionInvoice.prototype, "subscriptionId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => UserSubscription, (s) => s.invoices, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "subscription_id" }),
    __metadata("design:type", UserSubscription)
], SubscriptionInvoice.prototype, "subscription", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "user_id" }),
    __metadata("design:type", Number)
], SubscriptionInvoice.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User, (u) => u.invoices, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", User)
], SubscriptionInvoice.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "plan_id" }),
    __metadata("design:type", Number)
], SubscriptionInvoice.prototype, "planId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Plan, { onDelete: "RESTRICT" }),
    (0, typeorm_1.JoinColumn)({ name: "plan_id" }),
    __metadata("design:type", Plan)
], SubscriptionInvoice.prototype, "plan", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "amount_cents", default: 0 }),
    __metadata("design:type", Number)
], SubscriptionInvoice.prototype, "amountCents", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], SubscriptionInvoice.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], SubscriptionInvoice.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", name: "billing_period_start", nullable: true }),
    __metadata("design:type", Object)
], SubscriptionInvoice.prototype, "billingPeriodStart", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", name: "billing_period_end", nullable: true }),
    __metadata("design:type", Object)
], SubscriptionInvoice.prototype, "billingPeriodEnd", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "payment_gateway", nullable: true }),
    __metadata("design:type", Object)
], SubscriptionInvoice.prototype, "paymentGateway", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], SubscriptionInvoice.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => SubscriptionPayment, (p) => p.invoice),
    __metadata("design:type", Array)
], SubscriptionInvoice.prototype, "payments", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => RazorpayOrder, (r) => r.invoice),
    __metadata("design:type", Array)
], SubscriptionInvoice.prototype, "razorpayOrders", void 0);
exports.SubscriptionInvoice = SubscriptionInvoice = __decorate([
    (0, typeorm_1.Entity)({ name: "subscription_invoices" }),
    (0, typeorm_1.Index)("ix_subscription_invoices_subscription_id", ["subscriptionId"]),
    (0, typeorm_1.Index)("ix_subscription_invoices_user_id", ["userId"]),
    (0, typeorm_1.Index)("ix_subscription_invoices_plan_id", ["planId"]),
    (0, typeorm_1.Index)("ix_subscription_invoices_status", ["status"])
], SubscriptionInvoice);
let SubscriptionPayment = class SubscriptionPayment extends TimeStampedBase {
};
exports.SubscriptionPayment = SubscriptionPayment;
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "invoice_id" }),
    __metadata("design:type", Number)
], SubscriptionPayment.prototype, "invoiceId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => SubscriptionInvoice, (i) => i.payments, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "invoice_id" }),
    __metadata("design:type", SubscriptionInvoice)
], SubscriptionPayment.prototype, "invoice", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "user_id" }),
    __metadata("design:type", Number)
], SubscriptionPayment.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User, (u) => u.payments, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", User)
], SubscriptionPayment.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], SubscriptionPayment.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "amount_cents", default: 0 }),
    __metadata("design:type", Number)
], SubscriptionPayment.prototype, "amountCents", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], SubscriptionPayment.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], SubscriptionPayment.prototype, "gateway", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "gateway_event_id", nullable: true }),
    __metadata("design:type", Object)
], SubscriptionPayment.prototype, "gatewayEventId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", name: "gateway_payload", nullable: true }),
    __metadata("design:type", Object)
], SubscriptionPayment.prototype, "gatewayPayload", void 0);
exports.SubscriptionPayment = SubscriptionPayment = __decorate([
    (0, typeorm_1.Entity)({ name: "subscription_payments" }),
    (0, typeorm_1.Index)("ix_subscription_payments_invoice_id", ["invoiceId"]),
    (0, typeorm_1.Index)("ix_subscription_payments_user_id", ["userId"]),
    (0, typeorm_1.Index)("ix_subscription_payments_status", ["status"])
], SubscriptionPayment);
let RazorpayOrder = class RazorpayOrder extends TimeStampedBase {
};
exports.RazorpayOrder = RazorpayOrder;
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "user_id" }),
    __metadata("design:type", Number)
], RazorpayOrder.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User, (u) => u.razorpayOrders, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", User)
], RazorpayOrder.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "invoice_id", nullable: true }),
    __metadata("design:type", Object)
], RazorpayOrder.prototype, "invoiceId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => SubscriptionInvoice, (i) => i.razorpayOrders, {
        onDelete: "CASCADE",
        nullable: true,
    }),
    (0, typeorm_1.JoinColumn)({ name: "invoice_id" }),
    __metadata("design:type", Object)
], RazorpayOrder.prototype, "invoice", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "razorpay_order_id", nullable: true }),
    __metadata("design:type", Object)
], RazorpayOrder.prototype, "razorpayOrderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], RazorpayOrder.prototype, "receipt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "amount_cents", default: 0 }),
    __metadata("design:type", Number)
], RazorpayOrder.prototype, "amountCents", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], RazorpayOrder.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], RazorpayOrder.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], RazorpayOrder.prototype, "notes", void 0);
exports.RazorpayOrder = RazorpayOrder = __decorate([
    (0, typeorm_1.Entity)({ name: "razorpay_orders" }),
    (0, typeorm_1.Index)("ix_razorpay_orders_user_id", ["userId"]),
    (0, typeorm_1.Index)("ix_razorpay_orders_invoice_id", ["invoiceId"])
], RazorpayOrder);
let UserTradingAccountDetails = class UserTradingAccountDetails extends TimeStampedBase {
};
exports.UserTradingAccountDetails = UserTradingAccountDetails;
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "user_id" }),
    __metadata("design:type", Number)
], UserTradingAccountDetails.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User, (u) => u.tradingAccounts, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", User)
], UserTradingAccountDetails.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], UserTradingAccountDetails.prototype, "broker", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", name: "is_master", default: false }),
    __metadata("design:type", Boolean)
], UserTradingAccountDetails.prototype, "isMaster", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "execution_flow", nullable: true }),
    __metadata("design:type", Object)
], UserTradingAccountDetails.prototype, "executionFlow", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "account_label", nullable: true }),
    __metadata("design:type", Object)
], UserTradingAccountDetails.prototype, "accountLabel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", name: "account_meta", nullable: true }),
    __metadata("design:type", Object)
], UserTradingAccountDetails.prototype, "accountMeta", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "credentials_encrypted", nullable: true }),
    __metadata("design:type", Object)
], UserTradingAccountDetails.prototype, "credentialsEncrypted", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], UserTradingAccountDetails.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", name: "last_verified_at", nullable: true }),
    __metadata("design:type", Object)
], UserTradingAccountDetails.prototype, "lastVerifiedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => BrokerTradingAccountDetails, (bta) => bta.tradingAccount),
    __metadata("design:type", Array)
], UserTradingAccountDetails.prototype, "brokerLinks", void 0);
exports.UserTradingAccountDetails = UserTradingAccountDetails = __decorate([
    (0, typeorm_1.Entity)({ name: "user_trading_accounts_details" }),
    (0, typeorm_1.Index)("ix_user_trading_accounts_user_id", ["userId"]),
    (0, typeorm_1.Index)("ix_user_trading_accounts_status", ["status"])
], UserTradingAccountDetails);
let UserBillingDetails = class UserBillingDetails extends TimeStampedBase {
};
exports.UserBillingDetails = UserBillingDetails;
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "user_id" }),
    __metadata("design:type", Number)
], UserBillingDetails.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => User, (u) => u.billingDetails, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", User)
], UserBillingDetails.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "pan_number", nullable: true }),
    __metadata("design:type", Object)
], UserBillingDetails.prototype, "panNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "account_holder_name", nullable: true }),
    __metadata("design:type", Object)
], UserBillingDetails.prototype, "accountHolderName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "account_number", nullable: true }),
    __metadata("design:type", Object)
], UserBillingDetails.prototype, "accountNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "ifsc_code", nullable: true }),
    __metadata("design:type", Object)
], UserBillingDetails.prototype, "ifscCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "bank_name", nullable: true }),
    __metadata("design:type", Object)
], UserBillingDetails.prototype, "bankName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], UserBillingDetails.prototype, "branch", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "address_line1", nullable: true }),
    __metadata("design:type", Object)
], UserBillingDetails.prototype, "addressLine1", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "address_line2", nullable: true }),
    __metadata("design:type", Object)
], UserBillingDetails.prototype, "addressLine2", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], UserBillingDetails.prototype, "city", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], UserBillingDetails.prototype, "state", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], UserBillingDetails.prototype, "pincode", void 0);
exports.UserBillingDetails = UserBillingDetails = __decorate([
    (0, typeorm_1.Entity)({ name: "user_billing_details" }),
    (0, typeorm_1.Index)("uq_user_billing_details_user", ["userId"], { unique: true }),
    (0, typeorm_1.Index)("ix_user_billing_details_user_id", ["userId"])
], UserBillingDetails);
let MasterProfile = class MasterProfile extends TimeStampedBase {
};
exports.MasterProfile = MasterProfile;
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "user_id" }),
    __metadata("design:type", Number)
], MasterProfile.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => User, (u) => u.masterProfile, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", User)
], MasterProfile.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "numeric",
        precision: 5,
        scale: 2,
        name: "performance_fee_percent",
        default: 0,
    }),
    __metadata("design:type", String)
], MasterProfile.prototype, "performanceFeePercent", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", name: "is_verified", default: false }),
    __metadata("design:type", Boolean)
], MasterProfile.prototype, "isVerified", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => CopyRelationship, (cr) => cr.master),
    __metadata("design:type", Array)
], MasterProfile.prototype, "followers", void 0);
exports.MasterProfile = MasterProfile = __decorate([
    (0, typeorm_1.Entity)({ name: "master_profiles" }),
    (0, typeorm_1.Index)("uq_master_profiles_user", ["userId"], { unique: true }),
    (0, typeorm_1.Index)("ix_master_profiles_user_id", ["userId"])
], MasterProfile);
let CopyRelationship = class CopyRelationship extends TimeStampedBase {
};
exports.CopyRelationship = CopyRelationship;
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "master_id" }),
    __metadata("design:type", Number)
], CopyRelationship.prototype, "masterId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => MasterProfile, (m) => m.followers, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "master_id" }),
    __metadata("design:type", MasterProfile)
], CopyRelationship.prototype, "master", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "follower_id" }),
    __metadata("design:type", Number)
], CopyRelationship.prototype, "followerId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User, (u) => u.followingMasters, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "follower_id" }),
    __metadata("design:type", User)
], CopyRelationship.prototype, "follower", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], CopyRelationship.prototype, "approved", void 0);
exports.CopyRelationship = CopyRelationship = __decorate([
    (0, typeorm_1.Entity)({ name: "copy_relationships" }),
    (0, typeorm_1.Index)("uq_copy_relationship_master_follower", ["masterId", "followerId"], { unique: true }),
    (0, typeorm_1.Index)("ix_copy_relationships_master_id", ["masterId"]),
    (0, typeorm_1.Index)("ix_copy_relationships_follower_id", ["followerId"]),
    (0, typeorm_1.Index)("ix_copy_relationships_approved", ["approved"])
], CopyRelationship);
let BrokerCredential = class BrokerCredential extends TimeStampedBase {
};
exports.BrokerCredential = BrokerCredential;
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "key_name", nullable: true }),
    __metadata("design:type", Object)
], BrokerCredential.prototype, "keyName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "enc_api_key", nullable: true }),
    __metadata("design:type", Object)
], BrokerCredential.prototype, "encApiKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "enc_api_secret", nullable: true }),
    __metadata("design:type", Object)
], BrokerCredential.prototype, "encApiSecret", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "enc_request_token", nullable: true }),
    __metadata("design:type", Object)
], BrokerCredential.prototype, "encRequestToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], BrokerCredential.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => BrokerSession, (s) => s.brokerCredential),
    __metadata("design:type", Array)
], BrokerCredential.prototype, "sessions", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => BrokerTradingAccountDetails, (bta) => bta.broker),
    __metadata("design:type", Array)
], BrokerCredential.prototype, "tradingAccounts", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => AlertSnapshot, (a) => a.brokerCredentials),
    __metadata("design:type", Array)
], BrokerCredential.prototype, "alertSnapshots", void 0);
exports.BrokerCredential = BrokerCredential = __decorate([
    (0, typeorm_1.Entity)({ name: "broker_credentials" }),
    (0, typeorm_1.Index)("ix_broker_credentials_status", ["status"])
], BrokerCredential);
let BrokerSession = class BrokerSession extends TimeStampedBase {
};
exports.BrokerSession = BrokerSession;
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "broker_credential_id" }),
    __metadata("design:type", Number)
], BrokerSession.prototype, "brokerCredentialId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => BrokerCredential, (bc) => bc.sessions, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "broker_credential_id" }),
    __metadata("design:type", BrokerCredential)
], BrokerSession.prototype, "brokerCredential", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "session_token", nullable: true }),
    __metadata("design:type", Object)
], BrokerSession.prototype, "sessionToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", name: "expires_at", nullable: true }),
    __metadata("design:type", Object)
], BrokerSession.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", name: "last_refreshed_at", nullable: true }),
    __metadata("design:type", Object)
], BrokerSession.prototype, "lastRefreshedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], BrokerSession.prototype, "status", void 0);
exports.BrokerSession = BrokerSession = __decorate([
    (0, typeorm_1.Entity)({ name: "broker_sessions" }),
    (0, typeorm_1.Index)("ix_broker_sessions_cred_id", ["brokerCredentialId"]),
    (0, typeorm_1.Index)("ix_broker_sessions_expires_at", ["expiresAt"]),
    (0, typeorm_1.Index)("ix_broker_sessions_status", ["status"])
], BrokerSession);
let BrokerTradingAccountDetails = class BrokerTradingAccountDetails extends TimeStampedBase {
};
exports.BrokerTradingAccountDetails = BrokerTradingAccountDetails;
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "trading_account_id" }),
    __metadata("design:type", Number)
], BrokerTradingAccountDetails.prototype, "tradingAccountId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => UserTradingAccountDetails, (ta) => ta.brokerLinks, {
        onDelete: "CASCADE",
    }),
    (0, typeorm_1.JoinColumn)({ name: "trading_account_id" }),
    __metadata("design:type", UserTradingAccountDetails)
], BrokerTradingAccountDetails.prototype, "tradingAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "broker_id" }),
    __metadata("design:type", Number)
], BrokerTradingAccountDetails.prototype, "brokerId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => BrokerCredential, (bc) => bc.tradingAccounts, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "broker_id" }),
    __metadata("design:type", BrokerCredential)
], BrokerTradingAccountDetails.prototype, "broker", void 0);
exports.BrokerTradingAccountDetails = BrokerTradingAccountDetails = __decorate([
    (0, typeorm_1.Entity)({ name: "broker_trading_account_details" }),
    (0, typeorm_1.Index)("uq_broker_trading_account", ["tradingAccountId", "brokerId"], { unique: true }),
    (0, typeorm_1.Index)("ix_broker_trading_account_trading_account_id", ["tradingAccountId"]),
    (0, typeorm_1.Index)("ix_broker_trading_account_broker_id", ["brokerId"])
], BrokerTradingAccountDetails);
let AlertSnapshot = class AlertSnapshot extends TimeStampedBase {
};
exports.AlertSnapshot = AlertSnapshot;
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "broker_credentials_id", nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "brokerCredentialsId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => BrokerCredential, (bc) => bc.alertSnapshots, {
        nullable: true,
        onDelete: "SET NULL",
    }),
    (0, typeorm_1.JoinColumn)({ name: "broker_credentials_id" }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "brokerCredentials", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "user_id" }),
    __metadata("design:type", Number)
], AlertSnapshot.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User, (u) => u.alertSnapshots, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", User)
], AlertSnapshot.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "ticker", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "exchange", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "interval", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", name: "bar_time", nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "barTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", name: "alert_time", nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "alertTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 18, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "open", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 18, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "close", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 18, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "high", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 18, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "low", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 24, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "volume", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "base_currency", nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "baseCurrency", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => TradeSignal, (ts) => ts.alertSnapshot),
    __metadata("design:type", Array)
], AlertSnapshot.prototype, "tradeSignals", void 0);
exports.AlertSnapshot = AlertSnapshot = __decorate([
    (0, typeorm_1.Entity)({ name: "alert_snapshots" }),
    (0, typeorm_1.Index)("ix_alert_snapshots_user_id", ["userId"]),
    (0, typeorm_1.Index)("ix_alert_snapshots_broker_credentials_id", ["brokerCredentialsId"])
], AlertSnapshot);
let TradeSignal = class TradeSignal extends TimeStampedBase {
};
exports.TradeSignal = TradeSignal;
__decorate([
    (0, typeorm_1.Column)({ type: "bigint", name: "alert_snapshot_id" }),
    __metadata("design:type", Number)
], TradeSignal.prototype, "alertSnapshotId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => AlertSnapshot, (a) => a.tradeSignals, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "alert_snapshot_id" }),
    __metadata("design:type", AlertSnapshot)
], TradeSignal.prototype, "alertSnapshot", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: enums_1.CopyTradeSideEnum, nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "symbol", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 18, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "exchange", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "asset_type", nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "assetType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", name: "signal_time", nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "signalTime", void 0);
exports.TradeSignal = TradeSignal = __decorate([
    (0, typeorm_1.Entity)({ name: "trade_signals" }),
    (0, typeorm_1.Index)("ix_trade_signals_alert_snapshot_id", ["alertSnapshotId"])
], TradeSignal);
