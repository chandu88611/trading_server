import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./User";
import { ExecutionFlow, TradingAccountStatus } from "../app/subscriptionPlan/enums/subscriberPlan.enum";
@Entity({ name: "user_trading_accounts" })
export class UserTradingAccount {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user!: User;

  @Column()
  broker!: string;

  @Column({ type: "enum", enum: ExecutionFlow })
  executionFlow!: ExecutionFlow;

  @Column({ nullable: true })
  accountLabel!: string;

  @Column({ type: "text" })
  credentialsEncrypted!: string;

  @Column({
    type: "enum",
    enum: TradingAccountStatus,
    default: TradingAccountStatus.PENDING,
  })
  status!: TradingAccountStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
