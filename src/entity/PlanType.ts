import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from "typeorm";
import { SubscriptionPlan } from "./SubscriptionPlan";

@Entity({ name: "plan_types" })
export class PlanType {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string; // bigint -> string in JS runtime often

  @Column({ type: "text", unique: true })
  code!: string;

  @Column({ type: "text" })
  name!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @OneToMany(() => SubscriptionPlan, (p) => p.planType)
  plans?: SubscriptionPlan[];
}
