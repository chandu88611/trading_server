// src/entity/PlanStrategy.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { SubscriptionPlan } from "./SubscriptionPlan";
import { Strategy } from "./Strategy";

@Entity({ name: "plan_strategies" })
@Index(["planId", "strategyId"], { unique: true })
export class PlanStrategy {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: number; // BIGINT

  @Index()
  @Column({ name: "plan_id", type: "bigint" })
  planId!: number;

  @Index()
  @Column({ name: "strategy_id", type: "bigint" })
  strategyId!: number;

  @ManyToOne(() => SubscriptionPlan, (p) => p.planStrategies, { onDelete: "CASCADE" })
  @JoinColumn({ name: "plan_id" })
  plan!: SubscriptionPlan;

  @ManyToOne(() => Strategy, { onDelete: "CASCADE" })
  @JoinColumn({ name: "strategy_id" })
  strategy!: Strategy;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
