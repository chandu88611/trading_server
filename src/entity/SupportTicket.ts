import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type SupportTicketStatus =
  | "open"
  | "assigned"
  | "waiting_for_support"
  | "waiting_for_customer"
  | "closed";

export type SupportSyncStatus =
  | "pending"
  | "synced"
  | "failed"
  | "not_applicable";

@Entity({ name: "support_tickets" })
export class SupportTicket {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index("idx_support_tickets_user_updated_at")
  @Column({ name: "user_id", type: "int" })
  userId!: number;

  @Index({ unique: true })
  @Column({ name: "external_ticket_id", type: "varchar", length: 120 })
  externalTicketId!: string;

  @Index({ unique: true })
  @Column({ name: "crm_ticket_id", type: "varchar", length: 120, nullable: true })
  crmTicketId!: string | null;

  @Index("idx_support_tickets_platform_user_id")
  @Column({ name: "platform_user_id", type: "varchar", length: 120 })
  platformUserId!: string;

  @Column({ name: "contact_email", type: "citext" })
  contactEmail!: string;

  @Column({ name: "contact_name", type: "text", nullable: true })
  contactName!: string | null;

  @Column({ type: "varchar", length: 255 })
  subject!: string;

  @Index("idx_support_tickets_status_updated_at")
  @Column({ type: "varchar", length: 32 })
  status!: SupportTicketStatus;

  @Column({
    name: "assigned_executive_id",
    type: "varchar",
    length: 120,
    nullable: true,
  })
  assignedExecutiveId!: string | null;

  @Column({
    name: "assigned_executive_name",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  assignedExecutiveName!: string | null;

  @Column({
    name: "last_customer_message_at",
    type: "timestamptz",
    nullable: true,
  })
  lastCustomerMessageAt!: Date | null;

  @Column({
    name: "last_agent_reply_at",
    type: "timestamptz",
    nullable: true,
  })
  lastAgentReplyAt!: Date | null;

  @Column({ name: "closed_at", type: "timestamptz", nullable: true })
  closedAt!: Date | null;

  @Column({
    name: "sync_status",
    type: "varchar",
    length: 32,
    default: "pending",
  })
  syncStatus!: SupportSyncStatus;

  @Column({ name: "last_sync_error", type: "text", nullable: true })
  lastSyncError!: string | null;

  @Column({ name: "last_sync_at", type: "timestamptz", nullable: true })
  lastSyncAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
