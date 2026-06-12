import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "withdrawal_settings" })
export class WithdrawalSetting {
  @PrimaryColumn({ type: "int" })
  id!: number;

  @Column({
    name: "min_withdrawal_amount_inr",
    type: "numeric",
    precision: 15,
    scale: 2,
  })
  minWithdrawalAmountInr!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
