import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity({ name: "referral_reward_credits" })
@Index("uq_referral_reward_credit_source_beneficiary_level", [
  "sourceInvoiceId",
  "beneficiaryUserId",
  "level",
], { unique: true })
export class ReferralRewardCredit {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Index()
  @Column({ name: "source_invoice_id", type: "bigint" })
  sourceInvoiceId!: string;

  @Index()
  @Column({ name: "rewarded_user_id", type: "bigint" })
  rewardedUserId!: string;

  @Index()
  @Column({ name: "beneficiary_user_id", type: "bigint" })
  beneficiaryUserId!: string;

  @Column({ type: "int" })
  level!: 1 | 2;

  @Column({ name: "amount_inr", type: "numeric", precision: 15, scale: 2 })
  amountInr!: string;

  @Column({ name: "earned_at", type: "timestamptz" })
  earnedAt!: Date;

  @Column({ name: "available_at", type: "timestamptz" })
  availableAt!: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
