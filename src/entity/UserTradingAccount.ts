// src/entity/UserTradingAccount.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

import { User } from "./User";
import { UserSubscription } from "./UserSubscription";
import {
  ExecutionFlow,
  TradingAccountStatus,
} from "../app/subscriptionPlan/enums/subscriberPlan.enum";

@Entity({ name: "user_trading_accounts" })
export class UserTradingAccount {
  @PrimaryGeneratedColumn({ name: "id" })
  id!: number;

  @Index()
  @Column({ name: "user_id", type: "bigint" })
  userId!: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  // ✅ NEW: subscription link
  @Index()
  @Column({ name: "subscription_id", type: "bigint", nullable: true })
  subscriptionId!: number | null;

  @ManyToOne(() => UserSubscription, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "subscription_id" })
  subscription!: UserSubscription | null;

  @Column({ name: "is_master", type: "boolean", default: false })
  isMaster!: boolean;

  @Column({ name: "broker", type: "text" })
  broker!: string;

  @Column({
    name: "execution_flow",
    type: "enum",
    enum: ExecutionFlow,
    // If your DB enum type name is `execution_flow`, you can add:
    // enumName: "execution_flow",
  })
  executionFlow!: ExecutionFlow;

  @Column({ name: "account_label", type: "text", nullable: true })
  accountLabel!: string | null;

  @Column({ name: "account_meta", type: "jsonb", nullable: true })
  accountMeta!: Record<string, any> | null;

  @Column({ name: "credentials_encrypted", type: "text" })
  credentialsEncrypted!: string;

  @Column({
    name: "status",
    type: "enum",
    enum: TradingAccountStatus,
    // If your DB enum type name is `trading_account_status`, you can add:
    // enumName: "trading_account_status",
    default: TradingAccountStatus.PENDING,
  })
  status!: TradingAccountStatus;

  @Column({ name: "last_verified_at", type: "timestamptz", nullable: true })
  lastVerifiedAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
