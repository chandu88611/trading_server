import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./User";

export type WithdrawalRequestStatus =
  | "requested"
  | "approved"
  | "processing"
  | "queued"
  | "processed"
  | "rejected"
  | "failed"
  | "reversed";

@Entity({ name: "withdrawal_requests" })
export class WithdrawalRequest {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Index()
  @Column({ name: "user_id", type: "bigint" })
  userId!: string;

  @Column({ name: "amount_inr", type: "numeric", precision: 15, scale: 2 })
  amountInr!: string;

  @Column({ type: "text", default: "requested" })
  status!: WithdrawalRequestStatus;

  @Column({ name: "admin_reviewed_by_user_id", type: "bigint", nullable: true })
  adminReviewedByUserId!: string | null;

  @Column({ name: "admin_review_notes", type: "text", nullable: true })
  adminReviewNotes!: string | null;

  @Column({ name: "admin_reviewed_at", type: "timestamptz", nullable: true })
  adminReviewedAt!: Date | null;

  @Column({ name: "approved_at", type: "timestamptz", nullable: true })
  approvedAt!: Date | null;

  @Column({ name: "rejected_at", type: "timestamptz", nullable: true })
  rejectedAt!: Date | null;

  @Column({ name: "queued_at", type: "timestamptz", nullable: true })
  queuedAt!: Date | null;

  @Column({ name: "processed_at", type: "timestamptz", nullable: true })
  processedAt!: Date | null;

  @Column({ name: "failed_at", type: "timestamptz", nullable: true })
  failedAt!: Date | null;

  @Column({ name: "reversed_at", type: "timestamptz", nullable: true })
  reversedAt!: Date | null;

  @Column({ name: "razorpay_contact_id", type: "text", nullable: true })
  razorpayContactId!: string | null;

  @Column({ name: "razorpay_fund_account_id", type: "text", nullable: true })
  razorpayFundAccountId!: string | null;

  @Column({ name: "razorpay_payout_id", type: "text", nullable: true })
  razorpayPayoutId!: string | null;

  @Column({ name: "razorpay_payout_status", type: "text", nullable: true })
  razorpayPayoutStatus!: string | null;

  @Column({ name: "payout_idempotency_key", type: "text", nullable: true })
  payoutIdempotencyKey!: string | null;

  @Column({ name: "status_details", type: "jsonb", nullable: true })
  statusDetails!: Record<string, any> | null;

  @Column({ name: "failure_code", type: "text", nullable: true })
  failureCode!: string | null;

  @Column({ name: "failure_description", type: "text", nullable: true })
  failureDescription!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user?: User;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "admin_reviewed_by_user_id" })
  adminReviewer?: User | null;
}
