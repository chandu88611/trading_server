import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./User";
import { SubscriptionPlan } from "./SubscriptionPlan";
import { SubscriptionStatus } from "../app/subscriptionPlan/enums/subscriberPlan.enum";

@Entity({ name: "user_subscriptions" })
export class UserSubscription {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user!: User;

  @ManyToOne(() => SubscriptionPlan)
  plan!: SubscriptionPlan;

  /* NEW STATE MACHINE */
  @Column({
    type: "enum",
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status!: SubscriptionStatus;

  @Column({ name: "webhook_token", type: "text", nullable: true })
  webhookToken!: string | null;

  @Column({ name: "execution_enabled", default: true })
  executionEnabled!: boolean;

  @Column({ name: "liquidate_only_until", type: "timestamptz", nullable: true })
  liquidateOnlyUntil!: Date | null;

  @Column({ name: "start_date", type: "timestamptz", default: () => "now()" })
  startDate!: Date;

  @Column({ name: "end_date", type: "timestamptz", nullable: true })
  endDate!: Date | null;

  @Column({ type: "jsonb", nullable: true })
  metadata!: Record<string, any> | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
