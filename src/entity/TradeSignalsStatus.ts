import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  OneToOne,
} from "typeorm";
import { TradeSignal } from "./TradeSignals";

@Entity({ name: "trade_signals_status" })
export class TradeSignalStatus {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "signal_id", type: "int" })
  tradeSignalId!: number;
  
  @OneToOne(() => TradeSignal, { onDelete: "CASCADE" })
  @JoinColumn({ name: "signal_id" })
  tradeSignal!: TradeSignal;
  
  @Column({ type: "varchar", length: 40 })
  status!: string;

  @Column({ name: "attempts", type: "int", default: 0 })
  attempts!: number;

  @Column({ name: "last_error", type: "text", nullable: true })
  lastError!: string | null;

  @Column({ name: "next_retry_at", type: "timestamptz", nullable: true })
  nextRetryAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
