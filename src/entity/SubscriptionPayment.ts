import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { SubscriptionInvoice } from "./SubscriptionInvoice";
import { User } from "./User";

export type PaymentStatus = "initiated" | "successful" | "failed";

@Entity({ name: "subscription_payments" })
export class SubscriptionPayment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: "invoice_id", type: "bigint", nullable: true })
  invoiceId!: number | null;

  @Index()
  @Column({ name: "user_id", type: "bigint" })
  userId!: number;

  @Column({ type: "text" })
  status!: PaymentStatus;

  @Column({ name: "amount_cents", type: "int" })
  amountCents!: number;

  @Column({ type: "varchar", length: 10, default: "INR" })
  currency!: string;

  @Column({ type: "text" })
  gateway!: string;

  @Column({ name: "gateway_event_id", type: "text", unique: true, nullable: true })
  gatewayEventId!: string | null;

  @Column({ name: "gateway_payload", type: "jsonb", nullable: true })
  gatewayPayload!: Record<string, any> | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @ManyToOne(() => SubscriptionInvoice, { onDelete: "SET NULL" })
  @JoinColumn({ name: "invoice_id" })
  invoice!: SubscriptionInvoice | null;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;
}
