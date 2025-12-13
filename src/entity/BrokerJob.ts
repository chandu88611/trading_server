import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm";
import { BrokerCredential } from "./BrokerCredential";
import { TradeSignal } from "./TradeSignals";
import { AlertSnapshot } from "./AlertSnapshots";

@Entity({ name: "broker_jobs" })
@Index(["credential", "status"])
export class BrokerJob {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => BrokerCredential, { onDelete: "CASCADE" })
  @JoinColumn({ name: "credential_id" })
  credential!: BrokerCredential;

  @Column({ type: "text" })
  type!: string;

  @Column({ type: "jsonb", nullable: true })
  payload!: Record<string, any> | null;

  @Column({ type: "int", default: 0 })
  attempts!: number;

  @Column({ name: "last_error", type: "text", nullable: true })
  lastError!: string | null;

  @Column({ type: "text", default: "pending" })
  status!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @OneToMany(() => TradeSignal, (ts) => ts.brokerJob)
  tradeSignals!: TradeSignal[];

  @OneToMany(() => AlertSnapshot, (as) => as.brokerJob)
  alertSnapshots!: AlertSnapshot[];
}
