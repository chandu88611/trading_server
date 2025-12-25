import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { CopyMasterEvent } from "./CopyMasterEvent";
import { CopyTradingFollow } from "./CopyTradingFollow";

export enum CopyTaskStatus {
  QUEUED = "queued",
  SENT = "sent",
  EXECUTED = "executed",
  FAILED = "failed",
  SKIPPED = "skipped",
  CANCELLED = "cancelled",
}

@Entity({ name: "copy_trade_tasks" })
export class CopyTradeTask {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id!: string;

  @Column({ name: "master_event_id", type: "bigint" })
  masterEventId!: string;

  @ManyToOne(() => CopyMasterEvent, { onDelete: "CASCADE" })
  @JoinColumn({ name: "master_event_id" })
  masterEvent?: CopyMasterEvent;

  @Column({ name: "follow_id", type: "bigint" })
  followId!: string;

  @ManyToOne(() => CopyTradingFollow, { onDelete: "CASCADE" })
  @JoinColumn({ name: "follow_id" })
  follow?: CopyTradingFollow;

  @Column({
    type: "enum",
    enum: CopyTaskStatus,
    enumName: "copy_task_status",
    default: CopyTaskStatus.QUEUED,
  })
  status!: CopyTaskStatus;

  @Column({ type: "int", default: 0 })
  attempts!: number;

  @Column({ name: "last_error", type: "text", nullable: true })
  lastError!: string | null;

  @Column({ name: "follower_order_ref", type: "text", nullable: true })
  followerOrderRef!: string | null;

  @Column({ name: "follower_position_ref", type: "text", nullable: true })
  followerPositionRef!: string | null;

  @Column({
    name: "executed_quantity",
    type: "numeric",
    precision: 30,
    scale: 8,
    nullable: true,
  })
  executedQuantity!: string | null;

  @Column({
    name: "executed_price",
    type: "numeric",
    precision: 30,
    scale: 8,
    nullable: true,
  })
  executedPrice!: string | null;

  @Column({ name: "executed_at", type: "timestamptz", nullable: true })
  executedAt!: Date | null;

  @Column({ name: "latency_ms", type: "int", nullable: true })
  latencyMs!: number | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  payload!: Record<string, any>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
