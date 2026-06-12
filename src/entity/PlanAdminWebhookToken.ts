import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { SubscriptionPlan } from "./SubscriptionPlan";

@Entity({ name: "subscription_plan_admin_webhook_tokens" })
export class PlanAdminWebhookToken {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ name: "plan_id", type: "bigint" })
  planId!: number;

  @OneToOne(() => SubscriptionPlan, { onDelete: "CASCADE" })
  @JoinColumn({ name: "plan_id" })
  plan!: SubscriptionPlan;

  @Index({ unique: true })
  @Column({ type: "text" })
  token!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
