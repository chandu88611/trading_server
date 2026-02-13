import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity({ name: "ctrader_sessions" })
@Index(["userId"], { unique: true })
export class CTraderSession {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "user_id", type: "varchar", length: 255 })
  userId!: string;

  @Column({ name: "env", type: "enum", enum: ["demo", "live"], default: "demo" })
  env!: "demo" | "live";

  @Column({ name: "active_account_id", type: "integer", nullable: true })
  activeAccountId?: number | null;

  @Column({ name: "access_token_enc", type: "text", nullable: true })
  accessTokenEnc?: string | null;

  @Column({ name: "refresh_token_enc", type: "text", nullable: true })
  refreshTokenEnc?: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @Column({ name: "expires_at", type: "timestamp with time zone", nullable: true })
  expiresAt?: Date | null;
}
