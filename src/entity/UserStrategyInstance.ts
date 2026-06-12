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
import { Strategy } from "./Strategy";
import { SubscriptionPlan } from "./SubscriptionPlan";
import { UserSubscription } from "./UserSubscription";
import { UserTradingAccount } from "./UserTradingAccount";
import { UserStrategyStatus } from "../app/subscriptionPlan/enums/subscriberPlan.enum";

@Entity({ name: "user_strategy_instances" })
@Index(["subscriptionId", "strategyId"], { unique: true })
export class UserStrategyInstance {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: "user_id", type: "bigint" })
  userId!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Index()
  @Column({ name: "subscription_id", type: "bigint" })
  subscriptionId!: number;

  @ManyToOne(() => UserSubscription)
  @JoinColumn({ name: "subscription_id" })
  subscription!: UserSubscription;

  @Index()
  @Column({ name: "plan_id", type: "bigint" })
  planId!: number;

  @ManyToOne(() => SubscriptionPlan)
  @JoinColumn({ name: "plan_id" })
  plan!: SubscriptionPlan;

  @Index()
  @Column({ name: "strategy_id", type: "bigint" })
  strategyId!: number;

  @ManyToOne(() => Strategy)
  @JoinColumn({ name: "strategy_id" })
  strategy!: Strategy;

  @Index()
  @Column({ name: "trading_account_id", type: "bigint", nullable: true })
  tradingAccountId!: number | null;

  @ManyToOne(() => UserTradingAccount, { nullable: true })
  @JoinColumn({ name: "trading_account_id" })
  tradingAccount!: UserTradingAccount | null;

  @Column({
    type: "enum",
    enum: UserStrategyStatus,
    default: UserStrategyStatus.ACTIVE,
  })
  status!: UserStrategyStatus;

  @Column({ name: "strategy_version", type: "int" })
  strategyVersion!: number;

  @Column({ type: "jsonb", name: "frozen_params" })
  frozenParams!: Record<string, any>;

  @Column({ type: "numeric", precision: 4, scale: 2, default: () => "0.01" })
  volume!: string;

  @CreateDateColumn({ name: "activated_at", type: "timestamptz" })
  activatedAt!: Date;

  @Column({ name: "paused_at", type: "timestamptz", nullable: true })
  pausedAt!: Date | null;

  @Column({ name: "stopped_at", type: "timestamptz", nullable: true })
  stoppedAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
