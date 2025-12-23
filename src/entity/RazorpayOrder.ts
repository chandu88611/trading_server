import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity({ name: "razorpay_orders" })
export class RazorpayOrder {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Column({ name: "invoice_id", type: "bigint" })
  @Index()
  invoiceId!: string;

  @Column({ name: "user_id", type: "bigint" })
  @Index()
  userId!: string;

  @Column({ name: "razorpay_order_id", type: "text", unique: true })
  razorpayOrderId!: string;

  @Column({ type: "text", nullable: true })
  receipt!: string | null;

  @Column({ name: "amount_cents", type: "int" })
  amountCents!: number;

  @Column({ type: "varchar", length: 10, default: "INR" })
  currency!: string;

  @Column({ type: "text", default: "created" })
  status!: "created" | "attempted" | "paid" | "failed" | "cancelled";

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  notes!: Record<string, any>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
