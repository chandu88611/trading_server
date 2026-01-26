import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./User";
import { SubscriptionPlan } from "./SubscriptionPlan";
import { UserSubscription } from "./UserSubscription";

export type InvoiceStatus = "pending" | "paid" | "failed" | "refunded";

@Entity({ name: "subscription_invoices" })
export class SubscriptionInvoice {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: "subscription_id", type: "bigint" })
  subscriptionId!: number;

  @Index()
  @Column({ name: "user_id", type: "bigint" })
  userId!: number;

  @Index()
  @Column({ name: "plan_id", type: "uuid" })
  planId!: string;

  @Column({ name: "amount_cents", type: "int" })
  amountCents!: number;

  @Column({ type: "varchar", length: 10, default: "INR" })
  currency!: string;

  @Column({ type: "text", default: "pending" })
  status!: InvoiceStatus;

  @Column({ name: "billing_period_start", type: "timestamptz" })
  billingPeriodStart!: Date;

  @Column({ name: "billing_period_end", type: "timestamptz" })
  billingPeriodEnd!: Date;

  @Column({ name: "payment_gateway", type: "text", nullable: true })
  paymentGateway!: string | null;

  @Column({ name: "payment_reference", type: "text", nullable: true })
  paymentReference!: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata!: Record<string, any> | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @ManyToOne(() => UserSubscription, { onDelete: "CASCADE" })
  @JoinColumn({ name: "subscription_id" })
  subscription!: UserSubscription;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @ManyToOne(() => SubscriptionPlan, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "plan_id" })
  plan!: SubscriptionPlan;
}
