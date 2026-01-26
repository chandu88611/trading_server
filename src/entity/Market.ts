import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from "typeorm";
import { SubscriptionPlan } from "./SubscriptionPlan";

@Entity({ name: "markets" })
export class Market {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text", unique: true })
  code!: string; // FOREX / CRYPTO / INDIAN

  @Column({ type: "text" })
  name!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @OneToMany(() => SubscriptionPlan, (p) => p.market)
  plans?: SubscriptionPlan[];
}
