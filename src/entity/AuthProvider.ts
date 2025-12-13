// src/entity/AuthProvider.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  JoinColumn,
} from "typeorm";
import { User } from "./User";

@Index(["provider", "providerUserId"], { unique: true })
@Entity({ name: "auth_providers" })
export class AuthProvider {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int", name: "user_id" })
  userId!: number;

  @ManyToOne(() => User, (u) => u.authProviders, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "text" })
  provider!: string;

  @Column({ name: "provider_user_id", type: "text" })
  providerUserId!: string;

  @Column({ name: "provider_meta", type: "jsonb", nullable: true })
  providerMeta?: Record<string, any>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
