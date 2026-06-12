import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { User } from "./User";
import { AdminStrategyTrade } from "./AdminStrategyTrade";
import { Strategy } from "./Strategy";
import { SubscriptionPlan } from "./SubscriptionPlan";
import { UserSubscription } from "./UserSubscription";

@Entity({ name: "alert_snapshots" })
@Index("idx_alert_snapshots_admin_strategy_trade_id", ["adminStrategyTradeId"])
@Index("idx_alert_snapshots_strategy_created_at", ["strategyId", "createdAt"])
export class AlertSnapshot {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 20 })
  ticker!: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  exchange!: string;

  @Column({ type: "varchar", length: 10, nullable: true })
  interval!: string;

  @Column({ name: "bar_time", type: "timestamptz", nullable: true })
  barTime!: Date;

  @Column({ name: "alert_time", type: "timestamptz", nullable: true })
  alertTime!: Date;

  @Column({ type: "numeric", precision: 15, scale: 6, nullable: true })
  open!: number;

  @Column({ type: "numeric", precision: 15, scale: 6, nullable: true })
  close!: number;

  @Column({ type: "numeric", precision: 15, scale: 6, nullable: true })
  high!: number;

  @Column({ type: "numeric", precision: 15, scale: 6, nullable: true })
  low!: number;

  @Column({ type: "numeric", precision: 20, scale: 2, nullable: true })
  volume!: number;

  @Column({ type: "varchar", length: 10, nullable: true })
  currency!: string | null;

  @Column({ name: "base_currency", type: "varchar", length: 10, nullable: true })
  baseCurrency!: string | null;

  @Column({ name: "execution_mode", type: "varchar", length: 20, nullable: true })
  executionMode!: string | null;

  @Column({ name: "entry_ref", type: "varchar", length: 100, nullable: true })
  entryRef!: string | null;

  @Column({ name: "order_type", type: "varchar", length: 20, nullable: true })
  orderType!: string | null;

  @Column({ name: "limit_price", type: "numeric", precision: 15, scale: 6, nullable: true })
  limitPrice!: number | null;

  @Column({ name: "stop_price", type: "numeric", precision: 15, scale: 6, nullable: true })
  stopPrice!: number | null;

  @Column({ name: "stop_loss", type: "numeric", precision: 15, scale: 6, nullable: true })
  stopLoss!: number | null;

  @Column({ name: "take_profit", type: "numeric", precision: 15, scale: 6, nullable: true })
  takeProfit!: number | null;

  @Column({ name: "stop_loss_distance", type: "numeric", precision: 15, scale: 6, nullable: true })
  stopLossDistance!: number | null;

  @Column({ name: "take_profit_distance", type: "numeric", precision: 15, scale: 6, nullable: true })
  takeProfitDistance!: number | null;

  @Column({ name: "stop_loss_amount", type: "numeric", precision: 15, scale: 6, nullable: true })
  stopLossAmount!: number | null;

  @Column({ name: "take_profit_amount", type: "numeric", precision: 15, scale: 6, nullable: true })
  takeProfitAmount!: number | null;

  @Column({ name: "trailing_stop_loss", type: "boolean", nullable: true })
  trailingStopLoss!: boolean | null;

  @Column({ name: "guaranteed_stop_loss", type: "boolean", nullable: true })
  guaranteedStopLoss!: boolean | null;

  @Column({ name: "stop_loss_trigger_method", type: "varchar", length: 30, nullable: true })
  stopLossTriggerMethod!: string | null;

  @Column({
    name: "trailing_take_profit_activation_distance",
    type: "numeric",
    precision: 15,
    scale: 6,
    nullable: true,
  })
  trailingTakeProfitActivationDistance!: number | null;

  @Column({
    name: "trailing_take_profit_distance",
    type: "numeric",
    precision: 15,
    scale: 6,
    nullable: true,
  })
  trailingTakeProfitDistance!: number | null;

  @Column({
    name: "break_even_activation_distance",
    type: "numeric",
    precision: 15,
    scale: 6,
    nullable: true,
  })
  breakEvenActivationDistance!: number | null;

  @Column({
    name: "break_even_offset_distance",
    type: "numeric",
    precision: 15,
    scale: 6,
    nullable: true,
  })
  breakEvenOffsetDistance!: number | null;

  @Column({
    name: "trailing_stop_loss_distance",
    type: "numeric",
    precision: 15,
    scale: 6,
    nullable: true,
  })
  trailingStopLossDistance!: number | null;

  @Column({
    name: "trading_strength",
    type: "numeric",
    precision: 15,
    scale: 6,
    nullable: true,
  })
  tradingStrength!: number | null;

  @Column({ name: "admin_strategy_trade_id", type: "bigint", nullable: true })
  adminStrategyTradeId!: number | null;

  @ManyToOne(() => AdminStrategyTrade, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "admin_strategy_trade_id" })
  adminStrategyTrade!: AdminStrategyTrade | null;

  @Column({ name: "strategy_id", type: "bigint", nullable: true })
  strategyId!: number | null;

  @ManyToOne(() => Strategy, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "strategy_id" })
  strategy!: Strategy | null;

  @Column({ name: "plan_id", type: "bigint", nullable: true })
  planId!: number | null;

  @ManyToOne(() => SubscriptionPlan, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "plan_id" })
  plan!: SubscriptionPlan | null;

  @Column({ name: "subscription_id", type: "bigint", nullable: true })
  subscriptionId!: number | null;

  @ManyToOne(() => UserSubscription, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "subscription_id" })
  subscription!: UserSubscription | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @Column({ name: "user_id", type: "bigint" })
  userId!: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user?: User;
}
