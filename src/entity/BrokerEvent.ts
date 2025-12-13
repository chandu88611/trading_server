import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from "typeorm";
import { BrokerJob } from "./BrokerJob";

@Entity({ name: "broker_events" })
export class BrokerEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => BrokerJob, { onDelete: "CASCADE" })
  @JoinColumn({ name: "job_id" })
  job!: BrokerJob;

  @Column({ name: "event_type", type: "text" })
  eventType!: string;

  @Column({ type: "jsonb", nullable: true })
  payload!: Record<string, any> | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
