import {
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  ManyToOne,
  OneToOne,
} from "typeorm";
import { AssetType } from "../types/trade-identify";
import { User } from "./User";
import { UserTradingAccount } from "./UserTradingAccount";
import { AlertSnapshot } from "./AlertSnapshots";
import { TradeSignalStatus } from "./TradeSignalsStatus";
import { AdminStrategyTrade } from "./AdminStrategyTrade";
import { Strategy } from "./Strategy";
import { SubscriptionPlan } from "./SubscriptionPlan";
import { UserSubscription } from "./UserSubscription";

@Entity({ name: "trade_signals" })
@Index("idx_trade_signals_trading_account_entry_ref_created_at", ["tradingAccountId", "entryRef", "createdAt"])
@Index("idx_trade_signals_entry_ref_execution_mode", ["entryRef", "executionMode"])
@Index("idx_trade_signals_admin_strategy_trade_status", ["adminStrategyTradeId", "createdAt"])
@Index("idx_trade_signals_strategy_created_at", ["strategyId", "createdAt"])
export class TradeSignal {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 10 })
  action!: string;

  @Column({ type: "varchar", length: 20 })
  symbol!: string;

  @Column({ type: "numeric", precision: 10, scale: 5 })
  price!: number;

  @Column({ type: "varchar", length: 50 })
  exchange!: string;

  @Column({ name: "asset_type", type: "varchar", length: 20, enum: AssetType })
  assetType!: AssetType;

  // ── Indian-market instrument classification (explicit) ──
  @Column({ name: "instrument_type", type: "varchar", length: 20, nullable: true })
  instrumentType!: string | null; // EQUITY | FUTURES | OPTIONS

  @Column({ name: "product", type: "varchar", length: 20, nullable: true })
  product!: string | null; // INTRADAY | DELIVERY | MARGIN

  @Column({ name: "underlying", type: "varchar", length: 40, nullable: true })
  underlying!: string | null;

  @Column({ name: "expiry", type: "date", nullable: true })
  expiry!: string | null;

  @Column({ name: "option_type", type: "varchar", length: 4, nullable: true })
  optionType!: string | null; // CE | PE

  @Column({ name: "strike", type: "numeric", precision: 15, scale: 4, nullable: true })
  strike!: number | null;

  @Column({ name: "trading_symbol", type: "varchar", length: 120, nullable: true })
  tradingSymbol!: string | null;

  @Column({ name: "source_action", type: "varchar", length: 10, nullable: true })
  sourceAction!: string | null;

  @Column({ name: "broker_instrument_id", type: "bigint", nullable: true })
  brokerInstrumentId!: number | null;

  @Column({ name: "instrument_token", type: "varchar", length: 80, nullable: true })
  instrumentToken!: string | null;

  @Column({ name: "tick_size", type: "numeric", precision: 18, scale: 8, nullable: true })
  tickSize!: number | null;

  @Column({ name: "signal_time", type: "timestamptz" })
  signalTime!: Date;

  @Column({name: "volume", type: "numeric", precision: 20, scale: 2})
  volume!: number;

  @Column({ name: "order_id", type: "bigint", nullable: true })
  orderId?: number;

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

  @Column({ name: "broker_order_id", type: "bigint", nullable: true })
  brokerOrderId!: string | null;

  @Column({ name: "broker_position_id", type: "bigint", nullable: true })
  brokerPositionId!: string | null;

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

  @Column({name: "user_id", type: "bigint"})
  userId!: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({name: "trading_account_id", type: "bigint"})
  tradingAccountId!: number;

  @ManyToOne(() => UserTradingAccount, { onDelete: "CASCADE" })
  @JoinColumn({ name: "trading_account_id" })
  tradingAccount!: UserTradingAccount;

  @Column({ name: "alert_snapshots_id", type: "bigint"})
  alertSnapshotsId!: number;

  @ManyToOne(() => AlertSnapshot, { onDelete: "CASCADE" })
  @JoinColumn({ name: "alert_snapshots_id" })
  alertSnapshot!: AlertSnapshot;

  @OneToOne(() => TradeSignalStatus, (status) => status.tradeSignal)
  status!: TradeSignalStatus;
}
