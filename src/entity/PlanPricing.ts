import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { SubscriptionPlan } from "./SubscriptionPlan";
import { BillingInterval } from "../app/subscriptionPlan/enums/subscriberPlan.enum";

@Entity({ name: "plan_pricing" })
export class PlanPricing {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ name: "plan_id", type: "uuid" })
  planId!: string;

  @OneToOne(() => SubscriptionPlan, (p) => p.pricing, { onDelete: "CASCADE" })
  @JoinColumn({ name: "plan_id" })
  plan!: SubscriptionPlan;

  @Column({ name: "price_inr", type: "int" })
  priceInr!: number;

  @Column({ type: "varchar", length: 10, default: "INR" })
  currency!: string;

  @Column({
    name: "interval",
    type: "enum",
    enum: BillingInterval,
    enumName: "billing_interval",
    default: BillingInterval.MONTHLY,
  })
  interval!: BillingInterval;

  @Column({ name: "is_free", type: "boolean", default: false })
  isFree!: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
