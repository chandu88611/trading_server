import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User";

@Entity({ name: "user_risk_limits" })
export class UserRiskLimits {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id!: string;

  @Index({ unique: true })
  @Column({ name: "user_id", type: "bigint" })
  userId!: string;

  @OneToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ name: "is_enabled", type: "boolean", default: false })
  isEnabled!: boolean;

  @Column({
    name: "daily_loss_limit",
    type: "numeric",
    precision: 15,
    scale: 2,
    nullable: true,
  })
  dailyLossLimit!: number | null;

  @Column({
    name: "daily_profit_target",
    type: "numeric",
    precision: 15,
    scale: 2,
    nullable: true,
  })
  dailyProfitTarget!: number | null;

  @Column({ name: "max_trades_per_day", type: "int", nullable: true })
  maxTradesPerDay!: number | null;

  @Column({ name: "cooldown_after_loss_mins", type: "int", nullable: true })
  cooldownAfterLossMins!: number | null;

  @Column({ name: "configuration", type: "jsonb", default: () => "'{}'::jsonb" })
  configuration!: Record<string, any>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
