import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./User";
import { UserTradingAccount } from "./UserTradingAccount";
import { Strategy } from "./Strategy";

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
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id!: string;

  @Column({ name: "owner_user_id", type: "bigint", nullable: true })
  ownerUserId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "owner_user_id" })
  ownerUser?: User | null;

  @Column({
    name: "source_type",
    type: "enum",
    enum: CopyMasterSourceType,
    enumName: "copy_master_source_type",
    default: CopyMasterSourceType.TRADING_ACCOUNT,
  })
  sourceType!: CopyMasterSourceType;

  @Column({ name: "source_trading_account_id", type: "bigint", nullable: true })
  sourceTradingAccountId!: string | null;

  @ManyToOne(() => UserTradingAccount, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "source_trading_account_id" })
  sourceTradingAccount?: UserTradingAccount | null;

  @Column({ name: "source_strategy_id", type: "bigint", nullable: true })
  sourceStrategyId!: string | null;

  @ManyToOne(() => Strategy, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "source_strategy_id" })
  sourceStrategy?: Strategy | null;

  @Column({ type: "text" })
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({
    type: "enum",
    enum: CopyMasterVisibility,
    enumName: "copy_master_visibility",
    default: CopyMasterVisibility.PRIVATE,
  })
  visibility!: CopyMasterVisibility;

  @Column({ name: "requires_approval", type: "boolean", default: false })
  requiresApproval!: boolean;

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
