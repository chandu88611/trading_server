// src/entity/SubscriptionPlan.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
  OneToOne,
} from "typeorm";

import { PlanType } from "./PlanType";
import { Market } from "./Market";
import { PlanPricing } from "./PlanPricing";
import { PlanLimits } from "./PlanLimits";
import { PlanFeature } from "./PlanFeature";
import { PlanBundleItem } from "./PlanBundleItem";
import { UserSubscription } from "./UserSubscription";
import { SubscriptionInvoice } from "./SubscriptionInvoice";
import { PlanStrategy } from "./PlanStrategy";

@Entity({ name: "subscription_plans" })
export class SubscriptionPlan {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  // BIGINT in pg -> treat as string in TS to avoid mismatch
  @Index()
  @Column({ name: "plan_type_id", type: "bigint" })
  planTypeId!: string;

  @Index()
  @Column({ name: "market_id", type: "bigint", nullable: true })
  marketId!: string | null;

  @ManyToOne(() => PlanType, (t) => t.plans, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "plan_type_id" })
  planType!: PlanType;

  @ManyToOne(() => Market, (m) => m.plans, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "market_id" })
  market!: Market | null;

  @Column({ type: "text" })
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Index()
  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({
    name: "metadata",
    type: "jsonb",
    nullable: false,
    default: () => "'{}'::jsonb",
  })
  metadata!: Record<string, any>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  // 1-1 children
  @OneToOne(() => PlanPricing, (p) => p.plan)
  pricing?: PlanPricing;

  @OneToOne(() => PlanLimits, (l) => l.plan)
  limits?: PlanLimits;

  // 1-many children
  @OneToMany(() => PlanFeature, (f) => f.plan)
  features?: PlanFeature[];

  @OneToMany(() => PlanBundleItem, (bi) => bi.bundlePlan)
  bundleItems?: PlanBundleItem[];

  @OneToMany(() => PlanBundleItem, (bi) => bi.includedPlan)
  includedInBundles?: PlanBundleItem[];

  @OneToMany(() => PlanStrategy, (ps) => ps.plan)
  planStrategies?: PlanStrategy[];

  // existing relations
  @OneToMany(() => UserSubscription, (sub) => sub.plan)
  userSubscriptions?: UserSubscription[];

  @OneToMany(() => SubscriptionInvoice, (inv) => inv.plan)
  invoices?: SubscriptionInvoice[];
}
