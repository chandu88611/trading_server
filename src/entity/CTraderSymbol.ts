import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity({ name: "ctrader_symbols" })
@Index(["userId", "env", "accountId"], { unique: false })
export class CTraderSymbol {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "user_id", type: "varchar", length: 255 })
  userId!: string;

  @Column({ name: "env", type: "enum", enum: ["demo", "live"] })
  env!: "demo" | "live";

  @Column({ name: "account_id", type: "integer" })
  accountId!: number;

  @Column({ name: "symbol_name", type: "varchar", length: 50 })
  symbolName!: string;

  @Column({ name: "symbol_id", type: "integer" })
  symbolId!: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @Column({ name: "expires_at", type: "timestamp with time zone", nullable: true })
  expiresAt?: Date | null;
}
