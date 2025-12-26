import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./User";
import { ForexTradeCategory } from "./entity.enum";

@Entity({ name: "forex_trader_user_details" })
export class ForexTraderUserDetails {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id!: string;

  @Column({ name: "user_id", type: "bigint" })
  userId!: string;

  @Column({ name: "forex_trader_user_id", type: "varchar", length: 100 })
  forexTraderUserId!: string;

  @Column({
    name: "forex_type",
    type: "enum",
    enum: ForexTradeCategory,
    enumName: "forex_trade_category",
  })
  forexType!: ForexTradeCategory;

  @Column({ name: "token", type: "text", nullable: true })
  token!: string | null;

  @Column({ name: "is_master", type: "boolean", default: false })
  isMaster!: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "user_id" })
  user?: User | null;
}
