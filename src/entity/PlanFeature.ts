import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from "typeorm";
import { SubscriptionPlan } from "./SubscriptionPlan";

@Entity({ name: "plan_features" })
@Index(["planId", "featureKey"], { unique: true })
export class PlanFeature {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "plan_id", type: "uuid" })
  planId!: string;

  @ManyToOne(() => SubscriptionPlan, (p) => p.features, { onDelete: "CASCADE" })
  @JoinColumn({ name: "plan_id" })
  plan!: SubscriptionPlan;

  @Column({ name: "feature_key", type: "text" })
  featureKey!: string;

  @Column({ name: "feature_value", type: "text" })
  featureValue!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
