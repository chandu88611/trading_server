import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Check,
} from "typeorm";
import { SubscriptionPlan } from "./SubscriptionPlan";

@Entity({ name: "plan_bundle_items" })
@Index(["bundlePlanId", "includedPlanId"], { unique: true })
@Check(`"bundle_plan_id" <> "included_plan_id"`)
export class PlanBundleItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "bundle_plan_id", type: "uuid" })
  bundlePlanId!: string;

  @Column({ name: "included_plan_id", type: "uuid" })
  includedPlanId!: string;

  @ManyToOne(() => SubscriptionPlan, (p) => p.bundleItems, { onDelete: "CASCADE" })
  @JoinColumn({ name: "bundle_plan_id" })
  bundlePlan!: SubscriptionPlan;

  @ManyToOne(() => SubscriptionPlan, (p) => p.includedInBundles, { onDelete: "CASCADE" })
  @JoinColumn({ name: "included_plan_id" })
  includedPlan!: SubscriptionPlan;

  @Column({ type: "int", default: 1 })
  quantity!: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
