// import {
//   Column,
//   CreateDateColumn,
//   Entity,
//   Index,
//   JoinColumn,
//   ManyToOne,
//   PrimaryGeneratedColumn,
//   UpdateDateColumn,
// } from "typeorm";
// import { User } from "./User";
// import { UserTradingAccount } from "./UserTradingAccount";
// import { UserSubscription } from "./UserSubscription";
// import { CopyTradingMaster } from "./CopyTradingMaster";

// export enum CopyFollowStatus {
//   PENDING = "pending",
//   ACTIVE = "active",
//   PAUSED = "paused",
//   STOPPED = "stopped",
//   REJECTED = "rejected",
// }

// export enum CopyRiskMode {
//   MULTIPLIER = "multiplier",
//   FIXED_LOT = "fixed_lot",
//   FIXED_RISK_PCT = "fixed_risk_pct",
// }

// @Entity({ name: "copy_trading_follows" })
// export class CopyTradingFollow {
//   @PrimaryGeneratedColumn("increment", { type: "bigint" })
//   id!: string;

//   @Column({ name: "master_id", type: "bigint" })
//   masterId!: string;

//   @ManyToOne(() => CopyTradingMaster, { onDelete: "CASCADE" })
//   @JoinColumn({ name: "master_id" })
//   master?: CopyTradingMaster;

//   @Column({ name: "follower_user_id", type: "bigint" })
//   followerUserId!: string;

//   @ManyToOne(() => User, { onDelete: "CASCADE" })
//   @JoinColumn({ name: "follower_user_id" })
//   followerUser?: User;

//   @Column({ name: "follower_trading_account_id", type: "bigint" })
//   followerTradingAccountId!: string;

//   @ManyToOne(() => UserTradingAccount, { onDelete: "CASCADE" })
//   @JoinColumn({ name: "follower_trading_account_id" })
//   followerTradingAccount?: UserTradingAccount;

//   @Column({ name: "subscription_id", type: "bigint", nullable: true })
//   subscriptionId!: string | null;

//   @ManyToOne(() => UserSubscription, { nullable: true, onDelete: "SET NULL" })
//   @JoinColumn({ name: "subscription_id" })
//   subscription?: UserSubscription | null;

//   @Column({
//     type: "enum",
//     enum: CopyFollowStatus,
//     enumName: "copy_follow_status",
//     default: CopyFollowStatus.ACTIVE,
//   })
//   status!: CopyFollowStatus;

//   @Column({
//     name: "risk_mode",
//     type: "enum",
//     enum: CopyRiskMode,
//     enumName: "copy_risk_mode",
//     default: CopyRiskMode.MULTIPLIER,
//   })
//   riskMode!: CopyRiskMode;

//   @Column({
//     name: "risk_value",
//     type: "numeric",
//     precision: 12,
//     scale: 4,
//     default: 1,
//   })
//   riskValue!: string;

//   @Column({
//     name: "max_lot",
//     type: "numeric",
//     precision: 12,
//     scale: 4,
//     nullable: true,
//   })
//   maxLot!: string | null;

//   @Column({ name: "max_open_positions", type: "int", nullable: true })
//   maxOpenPositions!: number | null;

//   @Column({
//     name: "max_daily_loss",
//     type: "numeric",
//     precision: 14,
//     scale: 2,
//     nullable: true,
//   })
//   maxDailyLoss!: string | null;

//   @Column({
//     name: "slippage_tolerance",
//     type: "numeric",
//     precision: 12,
//     scale: 4,
//     nullable: true,
//   })
//   slippageTolerance!: string | null;

//   @Column({
//     name: "symbol_whitelist",
//     type: "text",
//     array: true,
//     nullable: true,
//   })
//   symbolWhitelist!: string[] | null;

//   @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
//   metadata!: Record<string, any>;

//   @CreateDateColumn({ name: "requested_at", type: "timestamptz" })
//   requestedAt!: Date;

//   @Column({ name: "approved_at", type: "timestamptz", nullable: true })
//   approvedAt!: Date | null;

//   @Column({ name: "paused_at", type: "timestamptz", nullable: true })
//   pausedAt!: Date | null;

//   @Column({ name: "stopped_at", type: "timestamptz", nullable: true })
//   stoppedAt!: Date | null;

//   @CreateDateColumn({ name: "created_at", type: "timestamptz" })
//   createdAt!: Date;

//   @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
//   updatedAt!: Date;
// }
// src/entity/CopyTradingFollow.ts
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
import { UserTradingAccount } from "./UserTradingAccount";
import { UserSubscription } from "./UserSubscription";
import { CopyTradingMaster } from "./CopyTradingMaster";

// If you already have these enums in your codebase, import them instead.
export enum CopyFollowStatus {
  PENDING = "pending",
  ACTIVE = "active",
  PAUSED = "paused",
  STOPPED = "stopped",
  REJECTED = "rejected",
}

export enum CopyRiskMode {
  MULTIPLIER = "multiplier",
  FIXED_LOT = "fixed_lot",
  FIXED_RISK_PCT = "fixed_risk_pct",
}

@Entity({ name: "copy_trading_follows" })
export class CopyTradingFollow {
  @PrimaryGeneratedColumn({ name: "id" })
  id!: number;

  @Index()
  @Column({ name: "master_id", type: "bigint" })
  masterId!: number;

  @ManyToOne(() => CopyTradingMaster, { onDelete: "CASCADE" })
  @JoinColumn({ name: "master_id" })
  master!: CopyTradingMaster;

  @Index()
  @Column({ name: "follower_user_id", type: "bigint" })
  followerUserId!: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "follower_user_id" })
  followerUser!: User;

  @Index()
  @Column({ name: "follower_trading_account_id", type: "bigint" })
  followerTradingAccountId!: number;

  @ManyToOne(() => UserTradingAccount, { onDelete: "CASCADE" })
  @JoinColumn({ name: "follower_trading_account_id" })
  followerTradingAccount!: UserTradingAccount;

  // ✅ already in DB: link follow to subscription (nullable)
  @Index()
  @Column({ name: "subscription_id", type: "bigint", nullable: true })
  subscriptionId!: number | null;

  @ManyToOne(() => UserSubscription, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "subscription_id" })
  subscription!: UserSubscription | null;

  @Column({
    name: "status",
    type: "enum",
    enum: CopyFollowStatus,
    // enumName: "copy_follow_status",
    default: CopyFollowStatus.ACTIVE,
  })
  status!: CopyFollowStatus;

  @Column({
    name: "risk_mode",
    type: "enum",
    enum: CopyRiskMode,
    // enumName: "copy_risk_mode",
    default: CopyRiskMode.MULTIPLIER,
  })
  riskMode!: CopyRiskMode;

  // Numeric in PG: keep string to avoid float issues
  @Column({ name: "risk_value", type: "numeric", precision: 12, scale: 4, default: 1.0 })
  riskValue!: string;

  @Column({ name: "max_lot", type: "numeric", precision: 12, scale: 4, nullable: true })
  maxLot!: string | null;

  @Column({ name: "max_open_positions", type: "int", nullable: true })
  maxOpenPositions!: number | null;

  @Column({ name: "max_daily_loss", type: "numeric", precision: 14, scale: 2, nullable: true })
  maxDailyLoss!: string | null;

  @Column({ name: "slippage_tolerance", type: "numeric", precision: 12, scale: 4, nullable: true })
  slippageTolerance!: string | null;

  @Column({ name: "symbol_whitelist", type: "text", array: true, nullable: true })
  symbolWhitelist!: string[] | null;

  @Column({ name: "metadata", type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, any>;

  @Column({ name: "requested_at", type: "timestamptz", nullable: true })
  requestedAt!: Date | null;

  @Column({ name: "approved_at", type: "timestamptz", nullable: true })
  approvedAt!: Date | null;

  @Column({ name: "paused_at", type: "timestamptz", nullable: true })
  pausedAt!: Date | null;

  @Column({ name: "stopped_at", type: "timestamptz", nullable: true })
  stoppedAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
