import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "ctrader_trailing_take_profit_monitors" })
@Index(["tradeSignalId"], { unique: true })
@Index(["monitorStatus", "updatedAt"])
export class CTraderTrailingTakeProfitMonitor {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "trade_signal_id", type: "bigint" })
  tradeSignalId!: number;

  @Column({ name: "user_id", type: "bigint" })
  userId!: number;

  @Column({ name: "trading_account_id", type: "bigint" })
  tradingAccountId!: number;

  @Column({ name: "account_id", type: "bigint" })
  accountId!: number;

  @Column({ name: "env", type: "varchar", length: 10 })
  env!: "demo" | "live";

  @Column({ name: "symbol", type: "varchar", length: 50 })
  symbol!: string;

  @Column({ name: "side", type: "varchar", length: 10 })
  side!: "BUY" | "SELL";

  @Column({ name: "entry_ref", type: "varchar", length: 100 })
  entryRef!: string;

  @Column({ name: "symbol_id", type: "integer", nullable: true })
  symbolId!: number | null;

  @Column({ name: "broker_order_id", type: "bigint", nullable: true })
  brokerOrderId!: string | null;

  @Column({ name: "broker_position_id", type: "bigint", nullable: true })
  brokerPositionId!: string | null;

  @Column({ name: "entry_price", type: "numeric", precision: 15, scale: 6, nullable: true })
  entryPrice!: number | null;

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

  @Column({ name: "best_price", type: "numeric", precision: 15, scale: 6, nullable: true })
  bestPrice!: number | null;

  @Column({ name: "armed", type: "boolean", default: false })
  armed!: boolean;

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

  @Column({ name: "stop_loss_protection_armed", type: "boolean", default: false })
  stopLossProtectionArmed!: boolean;

  @Column({ name: "stop_loss_best_price", type: "numeric", precision: 15, scale: 6, nullable: true })
  stopLossBestPrice!: number | null;

  @Column({ name: "current_stop_loss", type: "numeric", precision: 15, scale: 6, nullable: true })
  currentStopLoss!: number | null;

  @Column({ name: "monitor_status", type: "varchar", length: 20, default: "pending_fill" })
  monitorStatus!: "pending_fill" | "active" | "closing" | "completed" | "failed" | "disabled";

  @Column({ name: "last_error", type: "text", nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
