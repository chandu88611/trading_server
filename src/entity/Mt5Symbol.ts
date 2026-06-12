import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity({ name: "mt5_symbols" })
@Index("idx_mt5_symbols_account_symbol", ["brokerAccountId", "symbol"], { unique: true })
export class Mt5Symbol {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "broker_account_id", type: "text" })
  brokerAccountId!: string;

  @Column({ name: "symbol", type: "varchar", length: 50 })
  symbol!: string;

  @Column({ name: "digits", type: "integer", nullable: true })
  digits!: number | null;

  @Column({ name: "point", type: "numeric", precision: 18, scale: 10, nullable: true })
  point!: string | null;

  @Column({ name: "tick_size", type: "numeric", precision: 18, scale: 10, nullable: true })
  tickSize!: string | null;

  @Column({ name: "pip_size", type: "numeric", precision: 18, scale: 10, nullable: true })
  pipSize!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
