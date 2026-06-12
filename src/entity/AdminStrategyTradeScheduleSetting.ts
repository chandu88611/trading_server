import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "admin_strategy_trade_schedule_settings" })
export class AdminStrategyTradeScheduleSetting {
  @PrimaryColumn({ type: "int" })
  id!: number;

  @Column({ name: "is_enabled", type: "boolean", default: false })
  isEnabled!: boolean;

  @Column({ name: "timezone", type: "text", default: "Asia/Kolkata" })
  timezone!: string;

  @Column({
    name: "windows",
    type: "jsonb",
    default: () => "'[]'::jsonb",
  })
  windows!: Array<Record<string, unknown>>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
