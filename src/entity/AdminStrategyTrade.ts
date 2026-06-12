import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { SubscriptionPlan } from "./SubscriptionPlan";
import { Strategy } from "./Strategy";
import { User } from "./User";

export type AdminStrategyTradeStatus =
  | "received"
  | "blocked"
  | "fanned_out"
  | "no_signals"
  | "close_requested";

@Entity({ name: "admin_strategy_trades" })
@Index("idx_admin_strategy_trades_strategy_created_at", ["strategyId", "createdAt"])
@Index("idx_admin_strategy_trades_plan_created_at", ["planId", "createdAt"])
@Index("idx_admin_strategy_trades_status_created_at", ["status", "createdAt"])
export class AdminStrategyTrade {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: number;

  @Column({ name: "plan_id", type: "bigint" })
  planId!: number;

  @ManyToOne(() => SubscriptionPlan, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "plan_id" })
  plan!: SubscriptionPlan;

  @Column({ name: "strategy_id", type: "bigint" })
  strategyId!: number;

  @ManyToOne(() => Strategy, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "strategy_id" })
  strategy!: Strategy;

  @Column({ name: "placed_by_admin_user_id", type: "bigint", nullable: true })
  placedByAdminUserId!: number | null;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "placed_by_admin_user_id" })
  placedByAdminUser!: User | null;

  @Column({ type: "varchar", length: 30, default: "plan_webhook" })
  source!: string;

  @Column({ type: "varchar", length: 10 })
  action!: string;

  @Column({ type: "varchar", length: 20 })
  symbol!: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  exchange!: string | null;

  @Column({ type: "numeric", precision: 30, scale: 8, nullable: true })
  price!: number | null;

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

  @Column({ name: "trading_strength", type: "numeric", precision: 15, scale: 6, nullable: true })
  tradingStrength!: number | null;

  @Column({ name: "raw_payload", type: "jsonb", default: () => "'{}'::jsonb" })
  rawPayload!: Record<string, unknown>;

  @Column({ name: "execution_allowed", type: "boolean", default: false })
  executionAllowed!: boolean;

  @Column({ name: "schedule_blocked", type: "boolean", default: false })
  scheduleBlocked!: boolean;

  @Column({ name: "schedule_window_ids", type: "jsonb", default: () => "'[]'::jsonb" })
  scheduleWindowIds!: string[];

  @Column({ name: "recipient_count", type: "int", default: 0 })
  recipientCount!: number;

  @Column({ name: "snapshot_count", type: "int", default: 0 })
  snapshotCount!: number;

  @Column({ name: "signal_count", type: "int", default: 0 })
  signalCount!: number;

  @Column({ name: "close_queued_count", type: "int", default: 0 })
  closeQueuedCount!: number;

  @Column({ type: "varchar", length: 30, default: "received" })
  status!: AdminStrategyTradeStatus;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
