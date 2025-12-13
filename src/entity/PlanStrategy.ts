import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
} from "typeorm";
import { SubscriptionPlan } from "./SubscriptionPlan";
import { Strategy } from "./Strategy";

@Entity({ name: "plan_strategies" })
export class PlanStrategy {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => SubscriptionPlan, { onDelete: "CASCADE" })
  plan!: SubscriptionPlan;

  @ManyToOne(() => Strategy, { onDelete: "CASCADE" })
  strategy!: Strategy;

  @CreateDateColumn()
  createdAt!: Date;
}
