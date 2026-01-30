// src/entity/UserTradingAccount.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./User";
import { ExecutionFlow, TradingAccountStatus } from "../app/subscriptionPlan/enums/subscriberPlan.enum";

@Entity({ name: "user_trading_accounts" })
export class UserTradingAccount {
  @PrimaryGeneratedColumn({ name: "id" })
  id!: number;

  @Column({ name: "user_id", type: "int" })
  userId!: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ name: "is_master", type: "boolean", default: false })
  isMaster!: boolean;

 
  // if you want broker to be required, keep nullable: false (default)
  // if broker can be empty, set nullable: true
  @Column({ name: "broker", type: "text" })
  broker!: string;

  // IMPORTANT: your DB column exists. If DB enum type exists, use it.
  // If DB column is TEXT, change type: "text"
  @Column({
    name: "execution_flow",
    type: "enum",
    enum: ExecutionFlow,
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
