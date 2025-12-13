import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { ExecutionFlow, MarketCategory } from "../app/subscriptionPlan/enums/subscriberPlan.enum";

@Entity({ name: "strategies" })
export class Strategy {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "strategy_code", unique: true })
  strategyCode!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  description!: string;

  @Column({ type: "enum", enum: MarketCategory })
  category!: MarketCategory;

  @Column({ type: "enum", enum: ExecutionFlow, array: true })
  supportedExecutionFlows!: ExecutionFlow[];

  @Column({ default: 1 })
  version!: number;

  @Column({ type: "jsonb", default: {} })
  defaultParams!: Record<string, any>;

  @Column({ nullable: true })
  riskProfile!: string;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: false })
  isDeprecated!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
