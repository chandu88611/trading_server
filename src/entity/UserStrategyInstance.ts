import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./User";
import { Strategy } from "./Strategy";
import { SubscriptionPlan } from "./SubscriptionPlan";
import { UserSubscription } from "./UserSubscription";
import { UserTradingAccount } from "./UserTradingAccount";
import { UserStrategyStatus } from "../app/subscriptionPlan/enums/subscriberPlan.enum";

@Entity({ name: "user_strategy_instances" })
export class UserStrategyInstance {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User)
  user!: User;

  @ManyToOne(() => UserSubscription)
  subscription!: UserSubscription;

  @ManyToOne(() => SubscriptionPlan)
  plan!: SubscriptionPlan;

  @ManyToOne(() => Strategy)
  strategy!: Strategy;

  @ManyToOne(() => UserTradingAccount, { nullable: true })
  tradingAccount!: UserTradingAccount | null;

  @Column({
    type: "enum",
    enum: UserStrategyStatus,
    default: UserStrategyStatus.ACTIVE,
  })
  status!: UserStrategyStatus;

  @Column()
  strategyVersion!: number;

  @Column({ type: "jsonb" })
  frozenParams!: Record<string, any>;

  @CreateDateColumn()
  activatedAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
