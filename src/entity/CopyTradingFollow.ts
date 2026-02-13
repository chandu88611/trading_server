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

@Entity({ name: "copy_trading_followers" })
export class CopyTradingFollowers {
  @PrimaryGeneratedColumn({ name: "id" })
  id!: number;

  @Index()
  @Column({ name: "master_id", type: "bigint" })
  masterId!: number;

  @ManyToOne(() => UserTradingAccount, { onDelete: "CASCADE" })
  @JoinColumn({ name: "master_id" })
  master!: UserTradingAccount;

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

  @Column({
    name: "status",
    type: "enum",
    enum: CopyFollowStatus,
    default: CopyFollowStatus.ACTIVE,
  })
  status!: CopyFollowStatus;

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
