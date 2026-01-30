import {
  Column,
  CreateDateColumn,

  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import {
  CopyTradeSideEnum,
  PlanBillingCycleEnum,
  SubscriptionStatusEnum,
} from "../db/enums";

export type BigIntId = number;
export type JsonObject = Record<string, any>;

abstract class IdBase {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id!: BigIntId;
}

abstract class TimeStampedBase extends IdBase {
  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}

@Entity({ name: "users" })
@Index("ix_users_deleted_at", ["deletedAt"])
@Index("ix_users_last_login_at", ["lastLoginAt"])
export class User extends TimeStampedBase {
  @Column({ type: "text" })
  email!: string;

  @Column({ type: "text", nullable: true })
  name!: string | null;

  @Column({ type: "text", name: "password_hash", nullable: true })
  passwordHash!: string | null;

  @Column({ type: "boolean", name: "is_email_verified", default: false })
  isEmailVerified!: boolean;

  @Column({ type: "boolean", name: "is_active", default: true })
  isActive!: boolean;

  @Column({ type: "boolean", name: "is_admin", default: false })
  isAdmin!: boolean;

  @Column({ type: "text", name: "verification_token", nullable: true })
  verificationToken!: string | null;

  @Column({ type: "text", name: "reset_token", nullable: true })
  resetToken!: string | null;

  @Column({ type: "timestamptz", name: "reset_token_expires_at", nullable: true })
  resetTokenExpiresAt!: Date | null;

  @Column({ type: "integer", name: "failed_login_attempts", default: 0 })
  failedLoginAttempts!: number;

  @Column({ type: "timestamptz", name: "locked_at", nullable: true })
  lockedAt!: Date | null;

  @Column({ type: "boolean", name: "mfa_enabled", default: false })
  mfaEnabled!: boolean;

  @Column({ type: "text", name: "mfa_method", nullable: true })
  mfaMethod!: string | null;

  @Column({ type: "text", name: "mfa_secret", nullable: true })
  mfaSecret!: string | null;

  @Column({ type: "jsonb", name: "recovery_codes", nullable: true })
  recoveryCodes!: JsonObject | null;

  @Column({ type: "timestamptz", name: "last_login_at", nullable: true })
  lastLoginAt!: Date | null;

  @Column({ type: "inet", name: "last_login_ip", nullable: true })
  lastLoginIp!: string | null;

  @Column({ type: "text", name: "last_login_user_agent", nullable: true })
  lastLoginUserAgent!: string | null;

  @Column({ type: "timestamptz", name: "deleted_at", nullable: true })
  deletedAt!: Date | null;

  @Column({ type: "boolean", name: "allow_trade", default: true })
  allowTrade!: boolean;

  @Column({ type: "boolean", name: "allow_copy_trade", default: true })
  allowCopyTrade!: boolean;

  // relations
  @OneToMany(() => RefreshToken, (t) => t.user)
  refreshTokens!: RefreshToken[];

  @OneToMany(() => AuthProvider, (a) => a.user)
  authProviders!: AuthProvider[];

  @OneToMany(() => UserSubscription, (s) => s.user)
  subscriptions!: UserSubscription[];

  @OneToMany(() => SubscriptionInvoice, (i) => i.user)
  invoices!: SubscriptionInvoice[];

  @OneToMany(() => SubscriptionPayment, (p) => p.user)
  payments!: SubscriptionPayment[];

  @OneToMany(() => RazorpayOrder, (r) => r.user)
  razorpayOrders!: RazorpayOrder[];

  @OneToMany(() => UserTradingAccountDetails, (a) => a.user)
  tradingAccounts!: UserTradingAccountDetails[];

  @OneToOne(() => UserBillingDetails, (b) => b.user)
  billingDetails!: UserBillingDetails | null;

  @OneToOne(() => MasterProfile, (m) => m.user)
  masterProfile!: MasterProfile | null;

  @OneToMany(() => CopyRelationship, (cr) => cr.follower)
  followingMasters!: CopyRelationship[];

  @OneToMany(() => AlertSnapshot, (a) => a.user)
  alertSnapshots!: AlertSnapshot[];
}

@Entity({ name: "user_refresh_tokens" })
@Index("uq_user_refresh_tokens_token_hash", ["tokenHash"], { unique: true })
@Index("ix_user_refresh_tokens_user_id", ["userId"])
@Index("ix_user_refresh_tokens_expires_at", ["expiresAt"])
export class RefreshToken extends IdBase {
  @Column({ type: "bigint", name: "user_id" })
  userId!: BigIntId;

  @ManyToOne(() => User, (u) => u.refreshTokens, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "text", name: "token_hash" })
  tokenHash!: string;

  @Column({ type: "timestamptz", name: "expires_at" })
  expiresAt!: Date;

  @Column({ type: "boolean", default: false })
  revoked!: boolean;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;
}

@Entity({ name: "auth_providers" })
@Index("ix_auth_providers_user_id", ["userId"])
@Index("uq_auth_providers_user_provider", ["userId", "provider"], { unique: true })
export class AuthProvider extends IdBase {
  @Column({ type: "bigint", name: "user_id" })
  userId!: BigIntId;

  @ManyToOne(() => User, (u) => u.authProviders, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "text" })
  provider!: string;

  @Column({ type: "text", name: "provider_user_id", nullable: true })
  providerUserId!: string | null;

  @Column({ type: "jsonb", name: "provider_meta", nullable: true })
  providerMeta!: JsonObject | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;
}

@Entity({ name: "plan_types" })
@Index("uq_plan_types_code", ["code"], { unique: true })
export class PlanType extends IdBase {
  @Column({ type: "text" })
  code!: string;

  @Column({ type: "text" })
  name!: string;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @OneToMany(() => Plan, (p) => p.planType)
  plans!: Plan[];
}

@Entity({ name: "markets" })
@Index("uq_markets_code", ["code"], { unique: true })
export class Market extends IdBase {
  @Column({ type: "text" })
  code!: string;

  @Column({ type: "text" })
  name!: string;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @OneToMany(() => Plan, (p) => p.market)
  plans!: Plan[];

  @OneToMany(() => Strategy, (s) => s.market)
  strategies!: Strategy[];
}


@Entity({ name: "plans" })
@Index("ix_plans_plan_type_id", ["planTypeId"])
@Index("ix_plans_market_id", ["marketId"])
@Index("ix_plans_is_active", ["isActive"])
export class Plan extends TimeStampedBase {
  @Column({ type: "bigint", name: "plan_type_id" })
  planTypeId!: BigIntId;

  @ManyToOne(() => PlanType, (pt) => pt.plans, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "plan_type_id" })
  planType!: PlanType;

  @Column({ type: "bigint", name: "market_id" })
  marketId!: BigIntId;

  @ManyToOne(() => Market, (m) => m.plans, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "market_id" })
  market!: Market;

  @Column({ type: "text" })
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "boolean", name: "is_active", default: true })
  isActive!: boolean;

  @Column({ type: "jsonb", nullable: true })
  metadata!: JsonObject | null;

  @OneToMany(() => PlanFeature, (f) => f.plan)
  features!: PlanFeature[];

  @OneToOne(() => PlanLimits, (l) => l.plan)
  limits!: PlanLimits | null;

  @OneToMany(() => PlanPricing, (pp) => pp.plan)
  pricing!: PlanPricing[];

  @OneToMany(() => UserSubscription, (s) => s.plan)
  subscriptions!: UserSubscription[];

  @OneToMany(() => PlanStrategy, (ps) => ps.plan)
  planStrategies!: PlanStrategy[];

  @OneToMany(() => BundlePlan, (bp) => bp.bundlePlan)
  bundleIncludes!: BundlePlan[];

  @OneToMany(() => BundlePlan, (bp) => bp.includedPlan)
  includedInBundles!: BundlePlan[];
}

@Entity({ name: "plan_features" })
@Index("uq_plan_features_plan_key", ["planId", "featureKey"], { unique: true })
@Index("ix_plan_features_plan_id", ["planId"])
export class PlanFeature extends TimeStampedBase {
  @Column({ type: "bigint", name: "plan_id" })
  planId!: BigIntId;

  @ManyToOne(() => Plan, (p) => p.features, { onDelete: "CASCADE" })
  @JoinColumn({ name: "plan_id" })
  plan!: Plan;

  @Column({ type: "text", name: "feature_key" })
  featureKey!: string;

  @Column({ type: "text", name: "feature_value", nullable: true })
  featureValue!: string | null;
}

@Entity({ name: "plan_limits" })
@Index("uq_plan_limits_plan", ["planId"], { unique: true })
@Index("ix_plan_limits_plan_id", ["planId"])
export class PlanLimits extends TimeStampedBase {
  @Column({ type: "bigint", name: "plan_id" })
  planId!: BigIntId;

  @OneToOne(() => Plan, (p) => p.limits, { onDelete: "CASCADE" })
  @JoinColumn({ name: "plan_id" })
  plan!: Plan;

  @Column({ type: "numeric", precision: 18, scale: 2, name: "min_balance", nullable: true })
  minBalance!: string | null;

  @Column({ type: "integer", name: "max_connected_accounts", nullable: true })
  maxConnectedAccounts!: number | null;

  @Column({ type: "integer", name: "max_trades_per_week", nullable: true })
  maxTradesPerWeek!: number | null;

  @Column({ type: "numeric", precision: 18, scale: 2, name: "max_daily_trade", nullable: true })
  maxDailyTrade!: string | null;

  @Column({ type: "numeric", precision: 18, scale: 4, name: "max_lot_per_trade", nullable: true })
  maxLotPerTrade!: string | null;

  @Column({ type: "integer", name: "max_copy_following_accounts", nullable: true })
  maxCopyFollowingAccounts!: number | null;

  @Column({ type: "jsonb", nullable: true })
  metadata!: JsonObject | null;
}

@Entity({ name: "plan_pricing" })
@Index("uq_plan_pricing_plan_cycle", ["planId", "billingCycle"], { unique: true })
@Index("ix_plan_pricing_plan_id", ["planId"])
@Index("ix_plan_pricing_cycle", ["billingCycle"])
export class PlanPricing extends TimeStampedBase {
  @Column({ type: "bigint", name: "plan_id" })
  planId!: BigIntId;

  @ManyToOne(() => Plan, (p) => p.pricing, { onDelete: "CASCADE" })
  @JoinColumn({ name: "plan_id" })
  plan!: Plan;

  @Column({ type: "numeric", precision: 18, scale: 2, name: "plan_inr", nullable: true })
  planInr!: string | null;

  @Column({ type: "text", nullable: true })
  currency!: string | null;

  @Column({ type: "enum", enum: PlanBillingCycleEnum, name: "billing_cycle" })
  billingCycle!: PlanBillingCycleEnum;

  @Column({ type: "boolean", name: "is_free", default: false })
  isFree!: boolean;

  @Column({ type: "jsonb", nullable: true })
  metadata!: JsonObject | null;
}

@Entity({ name: "strategies" })
@Index("ix_strategies_market_id", ["marketId"])
@Index("ix_strategies_provider", ["provider"])
export class Strategy extends TimeStampedBase {
  @Column({ type: "bigint", name: "market_id" })
  marketId!: BigIntId;

  @ManyToOne(() => Market, (m) => m.strategies, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "market_id" })
  market!: Market;

  @Column({ type: "text" })
  name!: string;

  @Column({ type: "numeric", precision: 10, scale: 2, name: "avg_return_min", nullable: true })
  avgReturnMin!: string | null;

  @Column({ type: "numeric", precision: 10, scale: 2, name: "avg_return_max", nullable: true })
  avgReturnMax!: string | null;

  @Column({ type: "integer", name: "active_users", nullable: true })
  activeUsers!: number | null;

  @Column({ type: "text", nullable: true })
  provider!: string | null;

  @OneToOne(() => StrategyDetails, (d) => d.strategy)
  details!: StrategyDetails | null;

  @OneToMany(() => PlanStrategy, (ps) => ps.strategy)
  planStrategies!: PlanStrategy[];
}

@Entity({ name: "strategies_details" })
@Index("uq_strategies_details_strat", ["strategieId"], { unique: true })
@Index("ix_strategies_details_strat_id", ["strategieId"])
export class StrategyDetails extends TimeStampedBase {
  @Column({ type: "bigint", name: "strategie_id" })
  strategieId!: BigIntId;

  @OneToOne(() => Strategy, (s) => s.details, { onDelete: "CASCADE" })
  @JoinColumn({ name: "strategie_id" })
  strategy!: Strategy;

  @Column({ type: "jsonb", nullable: true })
  metadata!: JsonObject | null;
}

@Entity({ name: "plan_strategie" })
@Index("uq_plan_strategie", ["planId", "strategieId"], { unique: true })
@Index("ix_plan_strategie_plan_id", ["planId"])
@Index("ix_plan_strategie_strat_id", ["strategieId"])
export class PlanStrategy extends TimeStampedBase {
  @Column({ type: "bigint", name: "plan_id" })
  planId!: BigIntId;

  @ManyToOne(() => Plan, (p) => p.planStrategies, { onDelete: "CASCADE" })
  @JoinColumn({ name: "plan_id" })
  plan!: Plan;

  @Column({ type: "bigint", name: "strategie_id" })
  strategieId!: BigIntId;

  @ManyToOne(() => Strategy, (s) => s.planStrategies, { onDelete: "CASCADE" })
  @JoinColumn({ name: "strategie_id" })
  strategy!: Strategy;
}

@Entity({ name: "bundle_plans" })
@Index("uq_bundle_plans", ["bundlePlanId", "includedPlanId"], { unique: true })
@Index("ix_bundle_plans_bundle", ["bundlePlanId"])
@Index("ix_bundle_plans_included", ["includedPlanId"])
export class BundlePlan extends TimeStampedBase {
  @Column({ type: "bigint", name: "bundle_plan_id" })
  bundlePlanId!: BigIntId;

  @ManyToOne(() => Plan, (p) => p.bundleIncludes, { onDelete: "CASCADE" })
  @JoinColumn({ name: "bundle_plan_id" })
  bundlePlan!: Plan;

  @Column({ type: "bigint", name: "included_plan_id" })
  includedPlanId!: BigIntId;

  @ManyToOne(() => Plan, (p) => p.includedInBundles, { onDelete: "CASCADE" })
  @JoinColumn({ name: "included_plan_id" })
  includedPlan!: Plan;
}

@Entity({ name: "user_subscriptions" })
@Index("ix_user_subscriptions_user_id", ["userId"])
@Index("ix_user_subscriptions_plan_id", ["planId"])
@Index("ix_user_subscriptions_status", ["status"])
@Index("ix_user_subscriptions_user_status", ["userId", "status"])
export class UserSubscription extends TimeStampedBase {
  @Column({ type: "bigint", name: "plan_id" })
  planId!: BigIntId;

  @ManyToOne(() => Plan, (p) => p.subscriptions, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "plan_id" })
  plan!: Plan;

  @Column({ type: "bigint", name: "user_id" })
  userId!: BigIntId;

  @ManyToOne(() => User, (u) => u.subscriptions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "enum", enum: SubscriptionStatusEnum, default: SubscriptionStatusEnum.ACTIVE })
  status!: SubscriptionStatusEnum;

  @Column({ type: "date", name: "start_data", nullable: true })
  startDate!: string | null;

  @Column({ type: "date", name: "end_date", nullable: true })
  endDate!: string | null;

  @Column({ type: "boolean", name: "is_priority", default: false })
  isPriority!: boolean;

  @Column({ type: "boolean", name: "is_expired", default: false })
  isExpired!: boolean;

  @Column({ type: "boolean", name: "is_canceled", default: false })
  isCanceled!: boolean;

  @Column({ type: "timestamptz", name: "canceled_at", nullable: true })
  canceledAt!: Date | null;

  @OneToMany(() => SubscriptionInvoice, (i) => i.subscription)
  invoices!: SubscriptionInvoice[];
}

@Entity({ name: "subscription_invoices" })
@Index("ix_subscription_invoices_subscription_id", ["subscriptionId"])
@Index("ix_subscription_invoices_user_id", ["userId"])
@Index("ix_subscription_invoices_plan_id", ["planId"])
@Index("ix_subscription_invoices_status", ["status"])
export class SubscriptionInvoice extends TimeStampedBase {
  @Column({ type: "bigint", name: "subscription_id" })
  subscriptionId!: BigIntId;

  @ManyToOne(() => UserSubscription, (s) => s.invoices, { onDelete: "CASCADE" })
  @JoinColumn({ name: "subscription_id" })
  subscription!: UserSubscription;

  @Column({ type: "bigint", name: "user_id" })
  userId!: BigIntId;

  @ManyToOne(() => User, (u) => u.invoices, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "bigint", name: "plan_id" })
  planId!: BigIntId;

  @ManyToOne(() => Plan, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "plan_id" })
  plan!: Plan;

  @Column({ type: "integer", name: "amount_cents", default: 0 })
  amountCents!: number;

  @Column({ type: "text", nullable: true })
  currency!: string | null;

  @Column({ type: "text", nullable: true })
  status!: string | null;

  @Column({ type: "timestamptz", name: "billing_period_start", nullable: true })
  billingPeriodStart!: Date | null;

  @Column({ type: "timestamptz", name: "billing_period_end", nullable: true })
  billingPeriodEnd!: Date | null;

  @Column({ type: "text", name: "payment_gateway", nullable: true })
  paymentGateway!: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata!: JsonObject | null;

  @OneToMany(() => SubscriptionPayment, (p) => p.invoice)
  payments!: SubscriptionPayment[];

  @OneToMany(() => RazorpayOrder, (r) => r.invoice)
  razorpayOrders!: RazorpayOrder[];
}

@Entity({ name: "subscription_payments" })
@Index("ix_subscription_payments_invoice_id", ["invoiceId"])
@Index("ix_subscription_payments_user_id", ["userId"])
@Index("ix_subscription_payments_status", ["status"])
export class SubscriptionPayment extends TimeStampedBase {
  @Column({ type: "bigint", name: "invoice_id" })
  invoiceId!: BigIntId;

  @ManyToOne(() => SubscriptionInvoice, (i) => i.payments, { onDelete: "CASCADE" })
  @JoinColumn({ name: "invoice_id" })
  invoice!: SubscriptionInvoice;

  @Column({ type: "bigint", name: "user_id" })
  userId!: BigIntId;

  @ManyToOne(() => User, (u) => u.payments, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "text", nullable: true })
  status!: string | null;

  @Column({ type: "integer", name: "amount_cents", default: 0 })
  amountCents!: number;

  @Column({ type: "text", nullable: true })
  currency!: string | null;

  @Column({ type: "text", nullable: true })
  gateway!: string | null;

  @Column({ type: "text", name: "gateway_event_id", nullable: true })
  gatewayEventId!: string | null;

  @Column({ type: "jsonb", name: "gateway_payload", nullable: true })
  gatewayPayload!: JsonObject | null;
}

@Entity({ name: "razorpay_orders" })
@Index("ix_razorpay_orders_user_id", ["userId"])
@Index("ix_razorpay_orders_invoice_id", ["invoiceId"])
export class RazorpayOrder extends TimeStampedBase {
  @Column({ type: "bigint", name: "user_id" })
  userId!: BigIntId;

  @ManyToOne(() => User, (u) => u.razorpayOrders, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "bigint", name: "invoice_id", nullable: true })
  invoiceId!: BigIntId | null;

  @ManyToOne(() => SubscriptionInvoice, (i) => i.razorpayOrders, {
    onDelete: "CASCADE",
    nullable: true,
  })
  @JoinColumn({ name: "invoice_id" })
  invoice!: SubscriptionInvoice | null;

  @Column({ type: "text", name: "razorpay_order_id", nullable: true })
  razorpayOrderId!: string | null;

  @Column({ type: "text", nullable: true })
  receipt!: string | null;

  @Column({ type: "integer", name: "amount_cents", default: 0 })
  amountCents!: number;

  @Column({ type: "text", nullable: true })
  currency!: string | null;

  @Column({ type: "text", nullable: true })
  status!: string | null;

  @Column({ type: "jsonb", nullable: true })
  notes!: JsonObject | null;
}

@Entity({ name: "user_trading_accounts_details" })
@Index("ix_user_trading_accounts_user_id", ["userId"])
@Index("ix_user_trading_accounts_status", ["status"])
export class UserTradingAccountDetails extends TimeStampedBase {
  @Column({ type: "bigint", name: "user_id" })
  userId!: BigIntId;

  @ManyToOne(() => User, (u) => u.tradingAccounts, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "text", nullable: true })
  broker!: string | null;

  @Column({ type: "boolean", name: "is_master", default: false })
  isMaster!: boolean;

  @Column({ type: "text", name: "execution_flow", nullable: true })
  executionFlow!: string | null;

  @Column({ type: "text", name: "account_label", nullable: true })
  accountLabel!: string | null;

  @Column({ type: "jsonb", name: "account_meta", nullable: true })
  accountMeta!: JsonObject | null;

  @Column({ type: "text", name: "credentials_encrypted", nullable: true })
  credentialsEncrypted!: string | null;

  @Column({ type: "text", nullable: true })
  status!: string | null;

  @Column({ type: "timestamptz", name: "last_verified_at", nullable: true })
  lastVerifiedAt!: Date | null;

  @OneToMany(() => BrokerTradingAccountDetails, (bta) => bta.tradingAccount)
  brokerLinks!: BrokerTradingAccountDetails[];
}

@Entity({ name: "user_billing_details" })
@Index("uq_user_billing_details_user", ["userId"], { unique: true })
@Index("ix_user_billing_details_user_id", ["userId"])
export class UserBillingDetails extends TimeStampedBase {
  @Column({ type: "bigint", name: "user_id" })
  userId!: BigIntId;

  @OneToOne(() => User, (u) => u.billingDetails, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "text", name: "pan_number", nullable: true })
  panNumber!: string | null;

  @Column({ type: "text", name: "account_holder_name", nullable: true })
  accountHolderName!: string | null;

  @Column({ type: "text", name: "account_number", nullable: true })
  accountNumber!: string | null;

  @Column({ type: "text", name: "ifsc_code", nullable: true })
  ifscCode!: string | null;

  @Column({ type: "text", name: "bank_name", nullable: true })
  bankName!: string | null;

  @Column({ type: "text", nullable: true })
  branch!: string | null;

  @Column({ type: "text", name: "address_line1", nullable: true })
  addressLine1!: string | null;

  @Column({ type: "text", name: "address_line2", nullable: true })
  addressLine2!: string | null;

  @Column({ type: "text", nullable: true })
  city!: string | null;

  @Column({ type: "text", nullable: true })
  state!: string | null;

  @Column({ type: "text", nullable: true })
  pincode!: string | null;
}

@Entity({ name: "master_profiles" })
@Index("uq_master_profiles_user", ["userId"], { unique: true })
@Index("ix_master_profiles_user_id", ["userId"])
export class MasterProfile extends TimeStampedBase {
  @Column({ type: "bigint", name: "user_id" })
  userId!: BigIntId;

  @OneToOne(() => User, (u) => u.masterProfile, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({
    type: "numeric",
    precision: 5,
    scale: 2,
    name: "performance_fee_percent",
    default: 0,
  })
  performanceFeePercent!: string;

  @Column({ type: "boolean", name: "is_verified", default: false })
  isVerified!: boolean;

  @OneToMany(() => CopyRelationship, (cr) => cr.master)
  followers!: CopyRelationship[];
}

@Entity({ name: "copy_relationships" })
@Index("uq_copy_relationship_master_follower", ["masterId", "followerId"], { unique: true })
@Index("ix_copy_relationships_master_id", ["masterId"])
@Index("ix_copy_relationships_follower_id", ["followerId"])
@Index("ix_copy_relationships_approved", ["approved"])
export class CopyRelationship extends TimeStampedBase {
  @Column({ type: "bigint", name: "master_id" })
  masterId!: BigIntId;

  @ManyToOne(() => MasterProfile, (m) => m.followers, { onDelete: "CASCADE" })
  @JoinColumn({ name: "master_id" })
  master!: MasterProfile;

  @Column({ type: "bigint", name: "follower_id" })
  followerId!: BigIntId;

  @ManyToOne(() => User, (u) => u.followingMasters, { onDelete: "CASCADE" })
  @JoinColumn({ name: "follower_id" })
  follower!: User;

  @Column({ type: "boolean", default: false })
  approved!: boolean;
}

@Entity({ name: "broker_credentials" })
@Index("ix_broker_credentials_status", ["status"])
export class BrokerCredential extends TimeStampedBase {
  @Column({ type: "text", name: "key_name", nullable: true })
  keyName!: string | null;

  @Column({ type: "text", name: "enc_api_key", nullable: true })
  encApiKey!: string | null;

  @Column({ type: "text", name: "enc_api_secret", nullable: true })
  encApiSecret!: string | null;

  @Column({ type: "text", name: "enc_request_token", nullable: true })
  encRequestToken!: string | null;

  @Column({ type: "text", nullable: true })
  status!: string | null;

  @OneToMany(() => BrokerSession, (s) => s.brokerCredential)
  sessions!: BrokerSession[];

  @OneToMany(() => BrokerTradingAccountDetails, (bta) => bta.broker)
  tradingAccounts!: BrokerTradingAccountDetails[];

  @OneToMany(() => AlertSnapshot, (a) => a.brokerCredentials)
  alertSnapshots!: AlertSnapshot[];
}

@Entity({ name: "broker_sessions" })
@Index("ix_broker_sessions_cred_id", ["brokerCredentialId"])
@Index("ix_broker_sessions_expires_at", ["expiresAt"])
@Index("ix_broker_sessions_status", ["status"])
export class BrokerSession extends TimeStampedBase {
  @Column({ type: "bigint", name: "broker_credential_id" })
  brokerCredentialId!: BigIntId;

  @ManyToOne(() => BrokerCredential, (bc) => bc.sessions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "broker_credential_id" })
  brokerCredential!: BrokerCredential;

  @Column({ type: "text", name: "session_token", nullable: true })
  sessionToken!: string | null;

  @Column({ type: "timestamptz", name: "expires_at", nullable: true })
  expiresAt!: Date | null;

  @Column({ type: "timestamptz", name: "last_refreshed_at", nullable: true })
  lastRefreshedAt!: Date | null;

  @Column({ type: "text", nullable: true })
  status!: string | null;
}

@Entity({ name: "broker_trading_account_details" })
@Index("uq_broker_trading_account", ["tradingAccountId", "brokerId"], { unique: true })
@Index("ix_broker_trading_account_trading_account_id", ["tradingAccountId"])
@Index("ix_broker_trading_account_broker_id", ["brokerId"])
export class BrokerTradingAccountDetails extends TimeStampedBase {
  @Column({ type: "bigint", name: "trading_account_id" })
  tradingAccountId!: BigIntId;

  @ManyToOne(() => UserTradingAccountDetails, (ta) => ta.brokerLinks, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "trading_account_id" })
  tradingAccount!: UserTradingAccountDetails;

  @Column({ type: "bigint", name: "broker_id" })
  brokerId!: BigIntId;

  @ManyToOne(() => BrokerCredential, (bc) => bc.tradingAccounts, { onDelete: "CASCADE" })
  @JoinColumn({ name: "broker_id" })
  broker!: BrokerCredential;
}

@Entity({ name: "alert_snapshots" })
@Index("ix_alert_snapshots_user_id", ["userId"])
@Index("ix_alert_snapshots_broker_credentials_id", ["brokerCredentialsId"])
export class AlertSnapshot extends TimeStampedBase {
  @Column({ type: "bigint", name: "broker_credentials_id", nullable: true })
  brokerCredentialsId!: BigIntId | null;

  @ManyToOne(() => BrokerCredential, (bc) => bc.alertSnapshots, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "broker_credentials_id" })
  brokerCredentials!: BrokerCredential | null;

  @Column({ type: "bigint", name: "user_id" })
  userId!: BigIntId;

  @ManyToOne(() => User, (u) => u.alertSnapshots, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "text", nullable: true })
  ticker!: string | null;

  @Column({ type: "text", nullable: true })
  exchange!: string | null;

  @Column({ type: "text", nullable: true })
  interval!: string | null;

  @Column({ type: "timestamptz", name: "bar_time", nullable: true })
  barTime!: Date | null;

  @Column({ type: "timestamptz", name: "alert_time", nullable: true })
  alertTime!: Date | null;

  @Column({ type: "numeric", precision: 18, scale: 6, nullable: true })
  open!: string | null;

  @Column({ type: "numeric", precision: 18, scale: 6, nullable: true })
  close!: string | null;

  @Column({ type: "numeric", precision: 18, scale: 6, nullable: true })
  high!: string | null;

  @Column({ type: "numeric", precision: 18, scale: 6, nullable: true })
  low!: string | null;

  @Column({ type: "numeric", precision: 24, scale: 6, nullable: true })
  volume!: string | null;

  @Column({ type: "text", nullable: true })
  currency!: string | null;

  @Column({ type: "text", name: "base_currency", nullable: true })
  baseCurrency!: string | null;

  @OneToMany(() => TradeSignal, (ts) => ts.alertSnapshot)
  tradeSignals!: TradeSignal[];
}

@Entity({ name: "trade_signals" })
@Index("ix_trade_signals_alert_snapshot_id", ["alertSnapshotId"])
export class TradeSignal extends TimeStampedBase {
  @Column({ type: "bigint", name: "alert_snapshot_id" })
  alertSnapshotId!: BigIntId;

  @ManyToOne(() => AlertSnapshot, (a) => a.tradeSignals, { onDelete: "CASCADE" })
  @JoinColumn({ name: "alert_snapshot_id" })
  alertSnapshot!: AlertSnapshot;

  @Column({ type: "enum", enum: CopyTradeSideEnum, nullable: true })
  action!: CopyTradeSideEnum | null;

  @Column({ type: "text", nullable: true })
  symbol!: string | null;

  @Column({ type: "numeric", precision: 18, scale: 6, nullable: true })
  price!: string | null;

  @Column({ type: "text", nullable: true })
  exchange!: string | null;

  @Column({ type: "text", name: "asset_type", nullable: true })
  assetType!: string | null;

  @Column({ type: "timestamptz", name: "signal_time", nullable: true })
  signalTime!: Date | null;
}
