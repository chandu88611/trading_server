import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";
import { PlanStrategy } from "./PlanStrategy";

export type StrategyRisk = "Low" | "Medium" | "High";

@Entity({ name: "strategies" })
export class Strategy {
  // BIGINT IDs in postgres often come back as string in TS
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Index()
  @Column({ type: "varchar", length: 120 })
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Index()
  @Column({ type: "varchar", length: 60 })
  category!: string;

  @Column({ type: "varchar", length: 16, default: "Medium" })
  risk!: StrategyRisk;

  // easiest: store market codes as text[]
  // examples: ["FOREX"], ["CRYPTO"], ["INDIAN"], ["FOREX","CRYPTO"]
  @Column("text", { array: true, default: () => "ARRAY[]::text[]" })
  marketCodes!: string[];

  // numeric -> returned as string; UI converts to number
  @Column({ type: "numeric", precision: 8, scale: 2, default: 0 })
  avgMonthlyReturnPct!: string;

  @Column({ type: "numeric", precision: 6, scale: 2, default: 0 })
  winRatePct!: string;

  @Column({ type: "numeric", precision: 6, scale: 2, default: 0 })
  maxDrawdownPct!: string;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => PlanStrategy, (ps) => ps.strategy)
  planStrategies!: PlanStrategy[];
}
