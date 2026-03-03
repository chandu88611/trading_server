import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity({ name: "user_edging_status" })
export class UserEdgingStatus {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id!: string;

  @Index({ unique: true })
  @Column({ name: "user_id", type: "bigint" })
  userId!: string;

  @Column({ name: "is_enabled", type: "boolean", default: false })
  isEnabled!: boolean;

  @Column({ name: "notes", type: "text", nullable: true })
  notes?: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
