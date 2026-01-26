import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { SubscriptionPlan } from "./SubscriptionPlan";

@Entity({ name: "plan_limits" })
export class PlanLimits {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ name: "plan_id", type: "uuid" })
  planId!: string;

  @OneToOne(() => SubscriptionPlan, (p) => p.limits, { onDelete: "CASCADE" })
  @JoinColumn({ name: "plan_id" })
  plan!: SubscriptionPlan;

  @Column({ name: "min_balance", type: "numeric", precision: 14, scale: 2, nullable: true })
  minBalance!: string | null;

  @Column({ name: "max_trades_per_week", type: "int", nullable: true })
  maxTradesPerWeek!: number | null;

  @Column({ name: "max_connected_accounts", type: "int", nullable: true })
  maxConnectedAccounts!: number | null;

  @Column({ name: "max_daily_trades", type: "int", nullable: true })
  maxDailyTrades!: number | null;

  @Column({ name: "max_lot_per_trade", type: "numeric", precision: 12, scale: 4, nullable: true })
  maxLotPerTrade!: string | null;

  @Column({ name: "max_copy_masters", type: "int", nullable: true })
  maxCopyMasters!: number | null;

  @Column({ name: "max_copy_following_accounts", type: "int", nullable: true })
  maxCopyFollowingAccounts!: number | null;

  @Column({ name: "max_copy_followers_per_master", type: "int", nullable: true })
  maxCopyFollowersPerMaster!: number | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
