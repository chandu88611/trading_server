// src/entity/UserTradingAccount.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from "typeorm";

import { User } from "./User";
import { UserSubscription } from "./UserSubscription";
import {
  ExecutionFlow,
  TradingAccountStatus,
} from "../app/subscriptionPlan/enums/subscriberPlan.enum";
import { Broker } from "./Brokers";
import { TradeSignal } from "./TradeSignals";
import { CopyTradingMaster } from "./CopyTradingMaster";
import { CopyTradingFollowers } from "./CopyTradingFollow";

@Entity({ name: "user_trading_accounts" })
export class UserTradingAccount {
  @PrimaryGeneratedColumn({ name: "id" })
  id!: number;

  @Index()
  @Column({ name: "user_id", type: "bigint" })
  userId!: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Index()
  @Column({ name: "subscription_id", type: "bigint", nullable: true })
  subscriptionId!: number | null;

  @ManyToOne(() => UserSubscription, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "subscription_id" })
  subscription!: UserSubscription | null;

  @Column({ name: "is_master", type: "boolean", default: false })
  isMaster!: boolean;

  @Column({ name: "broker_id", type: "bigint" })
  brokerId!: number;

  @Column({ name: "account_id", type: "text" })
  accountId!: string;

  @ManyToOne(()=> Broker, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "broker_id" })
  broker!: Broker;

  @Column({ name: "account_label", type: "text", nullable: true })
  accountLabel!: string | null;

  @Column({ name: "account_meta", type: "jsonb", nullable: true })
  accountMeta!: Record<string, any> | null;

  @Column({ name: "credentials_encrypted", type: "text" })
  credentialsEncrypted!: string;

  @Column({ name: "is_enabled", type: "boolean", default: true })
  isEnabled!: boolean;

  @Column({
    name: "status",
    type: "enum",
    enum: TradingAccountStatus,
    default: TradingAccountStatus.PENDING,
  })
  status!: TradingAccountStatus;

  @Column({ name: "last_verified_at", type: "timestamptz", nullable: true })
  lastVerifiedAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @Column({name:"access_token", type: "text"})
  accessToken!: string;

  @Column({name:"refresh_token", type: "text"})
  refreshToken!: string;

  @OneToMany(() => TradeSignal, (tradeSignal) => tradeSignal.tradingAccount)
  tradeSignals!: TradeSignal[];

  @OneToMany(() => CopyTradingMaster, (ctm) => ctm.userTradingAccount)
  copyTradingMasterAccounts!: CopyTradingMaster[];

  @OneToMany(() => CopyTradingFollowers, (ctm) => ctm.followerTradingAccount)
  copyTradingFollowingAccounts!: CopyTradingFollowers[];
}
