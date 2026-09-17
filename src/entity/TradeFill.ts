import { Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm";
@Entity({ name: "trade_fill_history" })
@Index(["accountId", "fillId"], { unique: true })
export class TradeFill {
  @PrimaryGeneratedColumn({ type: "bigint" }) id!: string;
  @Column({ name: "account_id", type: "bigint" }) accountId!: number;
  @Column({ name: "signal_id", type: "int", nullable: true }) signalId!: number | null;
  @Column({ name: "fill_id", type: "text" }) fillId!: string;
  @Column({ name: "order_id", type: "text" }) orderId!: string;
  @Column({ type: "text" }) symbol!: string;
  @Column({ type: "text" }) side!: string;
  @Column({ name: "fill_price", type: "numeric", precision: 28, scale: 10 }) fillPrice!: number;
  @Column({ name: "fill_qty", type: "numeric", precision: 28, scale: 10 }) fillQty!: number;
  @Column({ type: "numeric", precision: 28, scale: 10, nullable: true }) fee!: number | null;
  @Column({ type: "text" }) currency!: string;
  @Column({ name: "executed_at", type: "timestamptz" }) timestamp!: Date;
  @Column({ name: "realized_pnl", type: "numeric", precision: 28, scale: 10, nullable: true }) realizedPnl!: number | null;
}
