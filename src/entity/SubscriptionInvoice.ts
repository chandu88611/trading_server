import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User";
import { SubscriptionPlan } from "./SubscriptionPlan";
import { UserSubscription } from "./UserSubscription";

export type InvoiceStatus = "pending" | "paid" | "failed" | "refunded";

@Entity({ name: "subscription_invoices" })
export class SubscriptionInvoice {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "subscription_id", type: "bigint" })
  subscriptionId!: number;

  @Column({ name: "user_id", type: "bigint" })
  userId!: number;

  @Column({ name: "plan_id", type: "bigint" })
  planId!: number;

  @Column({ name: "amount_cents", type: "int" })
  amountCents!: number;

  @Column({ type: "varchar", length: 10, default: "INR" })
  currency!: string;

  @Column({ type: "text", default: "pending" })
  status!: InvoiceStatus;

  @Column({
    name: "billing_period_start",
    type: "timestamptz",
  })
  billingPeriodStart!: Date;

  @Column({
    name: "billing_period_end",
    type: "timestamptz",
  })
  billingPeriodEnd!: Date;

  @Column({ name: "payment_gateway", type: "text", nullable: true })
  paymentGateway!: string | null;

  @Column({ name: "payment_reference", type: "text", nullable: true })
  paymentReference!: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata!: Record<string, any> | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @ManyToOne(() => UserSubscription, (sub) => sub.id, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "subscription_id" })
  subscription!: UserSubscription;

  @ManyToOne(() => User, (user) => user.id, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @ManyToOne(() => SubscriptionPlan, (plan) => plan.id)
  @JoinColumn({ name: "plan_id" })
  plan!: SubscriptionPlan;
}
