import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from "typeorm";
import { BrokerJob } from "./BrokerJob";
import { AssetType } from "../types/trade-identify";

@Entity({ name: "trade_signals" })
export class TradeSignal {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "job_id", type: "int" })
  jobId!: number;

  @ManyToOne(() => BrokerJob, (bj) => bj.tradeSignals, { onDelete: "CASCADE" })
  @JoinColumn({ name: "job_id" })
  brokerJob!: BrokerJob;

  @Column({ type: "varchar", length: 10 })
  action!: string;

  @Column({ type: "varchar", length: 20 })
  symbol!: string;

  @Column({ type: "numeric", precision: 10, scale: 5 })
  price!: number;

  @Column({ type: "varchar", length: 50 })
  exchange!: string;

  @Column({ name: "asset_type", type: "varchar", length: 20, enum: AssetType })
  assetType!: AssetType;

  @Column({ name: "signal_time", type: "timestamptz" })
  signalTime!: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
