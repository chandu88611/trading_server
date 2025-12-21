import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity({ name: "user_billing_details" })
export class UserBillingDetails {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id!: string;

  @Index({ unique: true })
  @Column({ name: "user_id", type: "bigint" })
  userId!: string;

  @Column({ name: "pan_number", type: "varchar", length: 10, nullable: true })
  panNumber?: string | null;

  @Column({ name: "account_holder_name", type: "varchar", length: 120, nullable: true })
  accountHolderName?: string | null;

  @Column({ name: "account_number", type: "varchar", length: 34, nullable: true })
  accountNumber?: string | null;

  @Column({ name: "ifsc_code", type: "varchar", length: 11, nullable: true })
  ifscCode?: string | null;

  @Column({ name: "bank_name", type: "varchar", length: 120, nullable: true })
  bankName?: string | null;

  @Column({ name: "branch", type: "varchar", length: 120, nullable: true })
  branch?: string | null;

  @Column({ name: "address_line1", type: "varchar", length: 255, nullable: true })
  addressLine1?: string | null;

  @Column({ name: "address_line2", type: "varchar", length: 255, nullable: true })
  addressLine2?: string | null;

  @Column({ name: "city", type: "varchar", length: 80, nullable: true })
  city?: string | null;

  @Column({ name: "state", type: "varchar", length: 80, nullable: true })
  state?: string | null;

  @Column({ name: "pincode", type: "varchar", length: 10, nullable: true })
  pincode?: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
