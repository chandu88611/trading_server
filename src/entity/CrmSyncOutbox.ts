import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type CrmSyncOutboxStatus =
  | "pending"
  | "processing"
  | "delivered"
  | "failed";

@Entity({ name: "crm_sync_outbox" })
export class CrmSyncOutbox {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ name: "event_id", type: "varchar", length: 120 })
  eventId!: string;

  @Column({ name: "event_type", type: "varchar", length: 120 })
  eventType!: string;

  @Column({ name: "organization_id", type: "varchar", length: 120, nullable: true })
  organizationId!: string | null;

  @Column({ type: "varchar", length: 32, default: "pending" })
  status!: CrmSyncOutboxStatus;

  @Column({ type: "int", default: 0 })
  attempts!: number;

  @Column({ name: "last_error", type: "text", nullable: true })
  lastError!: string | null;

  @Column({ name: "last_attempt_at", type: "timestamptz", nullable: true })
  lastAttemptAt!: Date | null;

  @Column({ name: "delivered_at", type: "timestamptz", nullable: true })
  deliveredAt!: Date | null;

  @Column({ name: "payload", type: "jsonb" })
  payload!: Record<string, any>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
