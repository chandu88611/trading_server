import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from "typeorm";
import { BrokerCredential } from "./BrokerCredential";

@Entity({ name: "broker_sessions" })
export class BrokerSession {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => BrokerCredential, { onDelete: "CASCADE" })
  @JoinColumn({ name: "credential_id" })
  credential!: BrokerCredential;

  @Column({ name: "session_token", type: "text", nullable: true })
  sessionToken!: string | null;

  @Column({ name: "expires_at", type: "timestamptz", nullable: true })
  expiresAt!: Date | null;

  @Column({ name: "last_refreshed_at", type: "timestamptz", nullable: true })
  lastRefreshedAt!: Date | null;

  @Column({ type: "text", default: "valid" })
  status!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
