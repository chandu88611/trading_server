import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from "typeorm";
import { User } from "./User";
import { ExecutionFlow, TradingAccountStatus } from "../app/subscriptionPlan/enums/subscriberPlan.enum";
@Entity({ name: "user_trading_accounts" })
export class UserTradingAccount {
  @PrimaryGeneratedColumn()
  id!: number;

    @Column({ name: "user_id", type: "int" })
  userId!: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column()
  broker!: string;

  @Column({ name:"execution_flow", type: "enum", enum: ExecutionFlow })
  executionFlow!: ExecutionFlow;

  @Column({ name:"account_label", nullable: true })
  accountLabel!: string;

  @Column({ name:"credentials_encrypted", type: "text" })
  credentialsEncrypted!: string;

  @Column({
    type: "enum",
    enum: TradingAccountStatus,
    default: TradingAccountStatus.PENDING,
  })
  status!: TradingAccountStatus;

  @Column({ name:"last_verified_at", type: "timestamptz", nullable: true })
  lastVerifiedAt!: Date | null;

  @CreateDateColumn({name: "created_at", type: "timestamptz"})
  createdAt!: Date;

  @UpdateDateColumn({name: "updated_at", type: "timestamptz"})
  updatedAt!: Date;
}
