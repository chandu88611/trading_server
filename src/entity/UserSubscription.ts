import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
  OneToMany,
} from "typeorm";

import { User } from "./User";
import { SubscriptionPlan } from "./SubscriptionPlan";
import { SubscriptionStatus } from "../app/subscriptionPlan/enums/subscriberPlan.enum";
import { UserTradingAccount } from "./UserTradingAccount";
import { CopyTradingFollowers } from "./CopyTradingFollow";

@Entity({ name: "user_subscriptions" })
export class UserSubscription {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: "user_id", type: "bigint" })
  userId!: number;

  @Index()
  @Column({ name: "plan_id", type: "bigint" })
  planId!: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @ManyToOne(() => SubscriptionPlan, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "plan_id" })
  plan!: SubscriptionPlan;

  @Column({
    name: "status_v2",
    type: "enum",
    enum: SubscriptionStatus,
    enumName: "subscription_status",
    nullable: true,
  })
  statusV2!: SubscriptionStatus | null;

  @Column({name:"auto_renew", type: "boolean", default: true})
  autoRenew!: boolean;

  @Column({ name: "webhook_token", type: "text", nullable: true })
  webhookToken!: string | null;

  @Column({ name: "execution_enabled", type: "boolean", default: true })
  executionEnabled!: boolean;

  @Column({ name: "liquidate_only_until", type: "timestamptz", nullable: true })
  liquidateOnlyUntil!: Date | null;

  @Column({ name: "start_date", type: "timestamptz", default: () => "now()" })
  startDate!: Date;

  @Column({ name: "end_date", type: "timestamptz", nullable: true })
  endDate!: Date | null;

  @Column({name: "cancel_at", type: "timestamptz", nullable: true})
  cancelAt!: Date | null;

  @Column({ type: "jsonb", nullable: true })
  metadata!: Record<string, any> | null;

  @OneToMany(() => UserTradingAccount, (a) => a.subscription)
  tradingAccounts!: UserTradingAccount[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
