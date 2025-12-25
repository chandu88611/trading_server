import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { CopyTradingMaster } from "./CopyTradingMaster";

export enum CopyEventType {
  OPEN = "OPEN",
  CLOSE = "CLOSE",
  MODIFY = "MODIFY",
  PARTIAL_CLOSE = "PARTIAL_CLOSE",
}

export enum CopyTradeSide {
  BUY = "BUY",
  SELL = "SELL",
}

@Entity({ name: "copy_master_events" })
export class CopyMasterEvent {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id!: number;

  @Column({ name: "master_id", type: "bigint" })
  masterId!: number;

  @ManyToOne(() => CopyTradingMaster, { onDelete: "CASCADE" })
  @JoinColumn({ name: "master_id" })
  master?: CopyTradingMaster;

  @Column({
    name: "event_type",
    type: "enum",
    enum: CopyEventType,
    enumName: "copy_event_type",
  })
  eventType!: CopyEventType;

  @Column({ type: "varchar", length: 64 })
  symbol!: string;

  @Column({
    type: "enum",
    enum: CopyTradeSide,
    enumName: "copy_trade_side",
    nullable: true,
  })
  side!: CopyTradeSide | null;

  @Column({ type: "numeric", precision: 30, scale: 8, nullable: true })
  quantity!: string | null;

  @Column({ type: "numeric", precision: 30, scale: 8, nullable: true })
  price!: string | null;

  @Column({ type: "numeric", precision: 30, scale: 8, nullable: true })
  sl!: string | null;

  @Column({ type: "numeric", precision: 30, scale: 8, nullable: true })
  tp!: string | null;

  @Column({ name: "master_order_ref", type: "text", nullable: true })
  masterOrderRef!: string | null;

  @Column({ name: "master_position_ref", type: "text", nullable: true })
  masterPositionRef!: string | null;

  @Column({ name: "signal_time", type: "timestamptz", default: () => "now()" })
  signalTime!: Date;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  payload!: Record<string, any>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
