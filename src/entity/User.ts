// src/entity/User.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { AuthProvider } from "./AuthProvider";
import { BrokerCredential } from "./BrokerCredential";

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "citext", unique: true })
  email!: string;

  @Column({ type: "text", nullable: true })
  name!: string | null;

  @Column({ name: "password_hash", type: "text", nullable: false })
  passwordHash!: string;

  @Column({
    name: "is_email_verified",
    type: "boolean",
    default: false,
  })
  isEmailVerified!: boolean;

  @Column({
    name: "is_active",
    type: "boolean",
    default: true,
  })
  isActive!: boolean;

  @Column({
    name: "is_admin",
    type: "boolean",
    default: false,
  })
  isAdmin!: boolean;

  @Column({ name: "verification_token", type: "text", nullable: true })
  verificationToken!: string | null;

  @Column({ name: "reset_token", type: "text", nullable: true })
  resetToken!: string | null;

  @Column({
    name: "reset_token_expires_at",
    type: "timestamptz",
    nullable: true,
  })
  resetTokenExpiresAt!: Date | null;

  @Column({
    name: "failed_login_attempts",
    type: "int",
    default: 0,
  })
  failedLoginAttempts!: number;

  @Column({ name: "locked_at", type: "timestamptz", nullable: true })
  lockedAt!: Date | null;

  @Column({ name: "mfa_enabled", type: "boolean", default: false })
  mfaEnabled!: boolean;

  @Column({ name: "mfa_method", type: "varchar", length: 20, nullable: true })
  mfaMethod!: string | null;

  @Column({ name: "mfa_secret", type: "text", nullable: true })
  mfaSecret!: string | null;

  @Column({ name: "recovery_codes", type: "jsonb", nullable: true })
  recoveryCodes!: string[] | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  @Column({ name: "last_login_at", type: "timestamptz", nullable: true })
  lastLoginAt!: Date | null;

  @Column({ name: "last_login_ip", type: "inet", nullable: true })
  lastLoginIp!: string | null;

  @Column({
    name: "last_login_user_agent",
    type: "text",
    nullable: true,
  })
  lastLoginUserAgent!: string | null;

  @Column({ name: "deleted_at", type: "timestamptz", nullable: true })
  deletedAt!: Date | null;

  @OneToMany(() => AuthProvider, (ap) => ap.user)
  authProviders?: AuthProvider[];

  @OneToMany(() => BrokerCredential, (bc) => bc.user)
  brokerCredentials?: BrokerCredential[];
}
