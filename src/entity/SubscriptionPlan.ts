// src/entity/SubscriptionPlan.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";
import { UserSubscription } from "./UserSubscription";
import { SubscriptionInvoice } from "./SubscriptionInvoice";
import {
  BillingInterval,
  ExecutionFlow,
  MarketCategory,
} from "../app/subscriptionPlan/enums/subscriberPlan.enum";

@Entity({ name: "subscription_plans" })
export class SubscriptionPlan {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ name: "plan_code", type: "text", unique: true })
  planCode!: string;

  @Column({ type: "text" })
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ name: "price_cents", type: "int" })
  priceCents!: number;

  @Column({ type: "varchar", length: 10, default: "INR" })
  currency!: string;

  // IMPORTANT: map to existing postgres enum type: billing_interval
  @Index()
  @Column({
    name: "interval",
    type: "enum",
    enum: BillingInterval,
    enumName: "billing_interval",
    default: BillingInterval.MONTHLY,
  })
  interval!: BillingInterval;

  // IMPORTANT: map to existing postgres enum type: market_category
  @Index()
  @Column({
    name: "category",
    type: "enum",
    enum: MarketCategory,
    enumName: "market_category",
    default: MarketCategory.CRYPTO,
  })
  category!: MarketCategory;

  // IMPORTANT: map to existing postgres enum type: execution_flow
  @Index()
  @Column({
    name: "execution_flow",
    type: "enum",
    enum: ExecutionFlow,
    enumName: "execution_flow",
    default: ExecutionFlow.API,
  })
  executionFlow!: ExecutionFlow;

  // entitlements/limits
  @Column({ name: "max_active_strategies", type: "int", default: 1 })
  maxActiveStrategies!: number;

  @Column({ name: "max_connected_accounts", type: "int", default: 1 })
  maxConnectedAccounts!: number;

  @Column({ name: "max_daily_trades", type: "int", nullable: true })
  maxDailyTrades!: number | null;

  // numeric comes as string from pg driver unless you transform
  @Column({
    name: "max_lot_per_trade",
    type: "numeric",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  maxLotPerTrade!: string | null;

  @Column({
    name: "feature_flags",
    type: "jsonb",
    nullable: false,
    default: () => "'{}'::jsonb",
  })
  featureFlags!: Record<string, any>;

  @Index()
  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ name: "metadata", type: "jsonb", nullable: true })
  metadata!: Record<string, any> | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @OneToMany(() => UserSubscription, (sub) => sub.plan)
  userSubscriptions?: UserSubscription[];

  @OneToMany(() => SubscriptionInvoice, (inv) => inv.plan)
  invoices?: SubscriptionInvoice[];
}
