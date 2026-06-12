import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { AdminStrategyTrade } from "./AdminStrategyTrade";
import { TradeSignal } from "./TradeSignals";
import { User } from "./User";
import { UserSubscription } from "./UserSubscription";
import { UserTradingAccount } from "./UserTradingAccount";

@Entity({ name: "subscriber_trade_alerts" })
@Index("idx_subscriber_trade_alerts_user_created_at", ["userId", "createdAt"])
@Index("idx_subscriber_trade_alerts_user_is_read_created_at", [
  "userId",
  "isRead",
  "createdAt",
])
export class SubscriberTradeAlert {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: number;

  @Column({ name: "user_id", type: "bigint" })
  userId!: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ name: "trade_signal_id", type: "int", unique: true })
  tradeSignalId!: number;

  @OneToOne(() => TradeSignal, { onDelete: "CASCADE" })
  @JoinColumn({ name: "trade_signal_id" })
  tradeSignal!: TradeSignal;

  @Column({ name: "subscription_id", type: "bigint", nullable: true })
  subscriptionId!: number | null;

  @ManyToOne(() => UserSubscription, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "subscription_id" })
  subscription!: UserSubscription | null;

  @Column({ name: "trading_account_id", type: "bigint" })
  tradingAccountId!: number;

  @ManyToOne(() => UserTradingAccount, { onDelete: "CASCADE" })
  @JoinColumn({ name: "trading_account_id" })
  tradingAccount!: UserTradingAccount;

  @Column({ name: "admin_strategy_trade_id", type: "bigint", nullable: true })
  adminStrategyTradeId!: number | null;

  @ManyToOne(() => AdminStrategyTrade, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "admin_strategy_trade_id" })
  adminStrategyTrade!: AdminStrategyTrade | null;

  @Column({ name: "event_type", type: "varchar", length: 30, default: "trade_placed" })
  eventType!: "trade_placed";

  @Column({ type: "varchar", length: 10 })
  action!: string;

  @Column({ type: "varchar", length: 20 })
  symbol!: string;

  @Column({ type: "varchar", length: 50 })
  exchange!: string;

  @Column({ type: "numeric", precision: 10, scale: 5 })
  price!: number;

  @Column({ type: "numeric", precision: 20, scale: 2 })
  volume!: number;

  @Column({ name: "signal_time", type: "timestamptz" })
  signalTime!: Date;

  @Column({ name: "is_read", type: "boolean", default: false })
  isRead!: boolean;

  @Column({ name: "read_at", type: "timestamptz", nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
