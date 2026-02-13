import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
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
  
  @Column({ type: "varchar", length: 20 })
  status!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
