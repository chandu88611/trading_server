import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { UserTradingAccount } from "./UserTradingAccount";

export enum CopyMasterSourceType {
  TRADING_ACCOUNT = "TRADING_ACCOUNT",
  STRATEGY = "STRATEGY",
}

export enum CopyMasterVisibility {
  PRIVATE = "private",
  UNLISTED = "unlisted",
  PUBLIC = "public",
}

@Entity({ name: "copy_trading_masters" })
export class CopyTradingMaster {
  @PrimaryGeneratedColumn()
  id!: string;

  @Column({ name: "user_trading_account_id", type: "bigint", nullable: true })
  userTradingAccountId!: number;

  @ManyToOne(() => UserTradingAccount, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "user_trading_account_id" })
  userTradingAccount?: UserTradingAccount;

  @Column({ name: "master_trading_account_id", type: "bigint", nullable: true })
  masterTradingAccountId!: number;

  @ManyToOne(() => UserTradingAccount, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "master_trading_account_id" })
  masterTradingAccount?: UserTradingAccount;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, any>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @DeleteDateColumn({ name: "deleted_at", type: "timestamptz", nullable: true })
  deletedAt!: Date | null;
}
