import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
} from "typeorm";
import { AssetType } from "../types/trade-identify";
import { User } from "./User";
import { UserTradingAccount } from "./UserTradingAccount";
import { AlertSnapshot } from "./AlertSnapshots";
import { TradeSignalStatus } from "./TradeSignalsStatus";

@Entity({ name: "trade_signals" })
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

  @Column({ name: "signal_time", type: "timestamptz" })
  signalTime!: Date;

  @Column({name: "volume", type: "numeric", precision: 20, scale: 2})
  volume!: number;

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
