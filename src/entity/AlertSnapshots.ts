import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { BrokerJob } from "./BrokerJob";

@Entity({ name: "alert_snapshots" })
export class AlertSnapshot {
  @PrimaryGeneratedColumn()
  id!: number;

  
  @Column({ name: "job_id", type: "int" })
  jobId!: number;

  @ManyToOne(() => BrokerJob, (bj) => bj.alertSnapshots, { onDelete: "CASCADE" })
  @JoinColumn({ name: "job_id" })
  brokerJob!: BrokerJob;

  @Column({ type: "varchar", length: 20 })
  ticker!: string;

  @Column({ type: "varchar", length: "50", nullable: true })
  exchange!: string;

  @Column({ type: "varchar", length: 10, nullable: true })
  interval!: string;

  @Column({ name: "bar_time", type: "timestamptz", nullable: true })
  barTime!: Date;

  @Column({ name: "alert_time", type: "timestamptz", nullable: true })
  alertTime!: Date;

  @Column({ type: "numeric", precision: 15, scale: 6, nullable: true })
  open!: number;

  @Column({ type: "numeric", precision: 15, scale: 6, nullable: true })
  close!: number;

  @Column({ type: "numeric", precision: 15, scale: 6, nullable: true })
  high!: number;

  @Column({ type: "numeric", precision: 15, scale: 6, nullable: true })
  low!: number;

  @Column({ type: "numeric", precision: 20, scale: 2, nullable: true })
  volume!: number;

  @Column({ type: "varchar", length: 10, nullable: true })
  currency!: string | null;

  @Column({ name: "base_currency", type: "varchar", length: 10, nullable: true })
  baseCurrency!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
