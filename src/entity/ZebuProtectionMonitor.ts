import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type ZebuProtectionMonitorStatus =
  | "pending_fill"
  | "active"
  | "closing"
  | "completed"
  | "failed"
  | "disabled";

@Entity({ name: "zebu_protection_monitors" })
@Index(["tradeSignalId"], { unique: true })
@Index(["monitorStatus", "updatedAt"])
export class ZebuProtectionMonitor {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "trade_signal_id", type: "bigint" })
  tradeSignalId!: number;

  @Column({ name: "user_id", type: "bigint" })
  userId!: number;

  @Column({ name: "trading_account_id", type: "bigint" })
  tradingAccountId!: number;

  @Column({ name: "symbol", type: "varchar", length: 80 })
  symbol!: string;

  @Column({ name: "exchange", type: "varchar", length: 20 })
  exchange!: string;

  @Column({ name: "side", type: "varchar", length: 10 })
  side!: "BUY" | "SELL";

  @Column({ name: "entry_ref", type: "varchar", length: 100, nullable: true })
  entryRef!: string | null;

  @Column({ name: "quantity", type: "numeric", precision: 20, scale: 6 })
  quantity!: number;

  @Column({ name: "product", type: "varchar", length: 20, nullable: true })
  product!: string | null;

  @Column({ name: "validity", type: "varchar", length: 20, nullable: true })
  validity!: string | null;

  @Column({ name: "entry_order_id", type: "bigint" })
  entryOrderId!: string;

  @Column({ name: "stop_order_id", type: "bigint", nullable: true })
  stopOrderId!: string | null;

  @Column({ name: "target_order_id", type: "bigint", nullable: true })
  targetOrderId!: string | null;

  @Column({ name: "token", type: "varchar", length: 60, nullable: true })
  token!: string | null;

  @Column({ name: "tick_size", type: "numeric", precision: 18, scale: 8, nullable: true })
  tickSize!: number | null;

  @Column({ name: "entry_price", type: "numeric", precision: 15, scale: 6, nullable: true })
  entryPrice!: number | null;

  @Column({ name: "stop_loss", type: "numeric", precision: 15, scale: 6, nullable: true })
  stopLoss!: number | null;

  @Column({ name: "take_profit", type: "numeric", precision: 15, scale: 6, nullable: true })
  takeProfit!: number | null;

  @Column({ name: "stop_loss_distance", type: "numeric", precision: 15, scale: 6, nullable: true })
  stopLossDistance!: number | null;

  @Column({ name: "take_profit_distance", type: "numeric", precision: 15, scale: 6, nullable: true })
  takeProfitDistance!: number | null;

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

  @Column({ name: "current_stop_price", type: "numeric", precision: 15, scale: 6, nullable: true })
  currentStopPrice!: number | null;

  @Column({ name: "best_price", type: "numeric", precision: 15, scale: 6, nullable: true })
  bestPrice!: number | null;

  @Column({ name: "monitor_status", type: "varchar", length: 20, default: "pending_fill" })
  monitorStatus!: ZebuProtectionMonitorStatus;

  @Column({ name: "last_error", type: "text", nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
