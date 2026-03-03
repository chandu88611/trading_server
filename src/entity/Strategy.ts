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

@Entity({ name: "strategies" })
export class Strategy {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: number;

  @Index()
  @Column({ name: "strategy_code", type: "text", unique: true })
  strategyCode!: string;

  @Index()
  @Column({ name: "name", type: "text" })
  name!: string;

  @Column({ name: "description", type: "text", nullable: true })
  description!: string | null;

  @Index()
  @Column({ name: "category", type: "varchar" })
  category!: string;

  @Column({ name: "version", type: "int", default: 1 })
  version!: number;

  @Column({
    name: "default_params",
    type: "jsonb",
    nullable: false,
    default: () => "'{}'::jsonb",
  })
  defaultParams!: Record<string, any>;

  @Column({ name: "risk_profile", type: "text", nullable: true })
  riskProfile!: string | null;

  @Column({ name: "capital_requirement", type: "numeric", precision: 12, scale: 2, nullable: true })
  capitalRequirement!: string | null;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ name: "is_deprecated", type: "boolean", default: false })
  isDeprecated!: boolean;

  @Column({ name: "is_copyable", type: "boolean", default: true })
  isCopyable!: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @OneToMany(() => PlanStrategy, (ps) => ps.strategy)
  planStrategies!: PlanStrategy[];
}
