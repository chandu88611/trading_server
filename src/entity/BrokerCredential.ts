import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from "typeorm";
import { User } from "./User";

@Entity({ name: "broker_credentials" })
@Index(["user", "keyName"], { unique: true })
export class BrokerCredential {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, (u) => u.brokerCredentials, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ name: "key_name", type: "text", nullable: true })
  keyName!: string | null;

  @Column({ name: "enc_api_key", type: "text", nullable: true })
  encApiKey!: string | null;

  @Column({ name: "enc_api_secret", type: "text", nullable: true })
  encApiSecret!: string | null;

  @Column({ name: "enc_request_token", type: "text", nullable: true })
  encRequestToken!: string | null;

  @Column({ type: "text", default: "active" })
  status!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
