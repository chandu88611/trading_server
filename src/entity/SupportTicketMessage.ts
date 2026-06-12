import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { SupportSyncStatus } from "./SupportTicket";

export type SupportTicketMessageAuthorType = "customer" | "support" | "system";

@Entity({ name: "support_ticket_messages" })
export class SupportTicketMessage {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index("idx_support_ticket_messages_ticket_created_at")
  @Column({ name: "ticket_id", type: "int" })
  ticketId!: number;

  @Index({ unique: true })
  @Column({
    name: "external_message_id",
    type: "varchar",
    length: 120,
    nullable: true,
  })
  externalMessageId!: string | null;

  @Index({ unique: true })
  @Column({
    name: "crm_message_id",
    type: "varchar",
    length: 120,
    nullable: true,
  })
  crmMessageId!: string | null;

  @Column({ name: "author_type", type: "varchar", length: 32 })
  authorType!: SupportTicketMessageAuthorType;

  @Column({ type: "text" })
  body!: string;

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

  @Column({ name: "emailed_at", type: "timestamptz", nullable: true })
  emailedAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
