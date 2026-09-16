import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "broker_instruments" })
@Index("uq_broker_instruments_broker_exchange_symbol", ["brokerCode", "exchange", "tradingSymbol"], {
  unique: true,
})
@Index("idx_broker_instruments_option_lookup", [
  "brokerCode",
  "exchange",
  "underlying",
  "instrumentType",
  "optionType",
  "expiry",
  "isActive",
])
@Index("idx_broker_instruments_type_expiry_strike", [
  "brokerCode",
  "exchange",
  "instrumentType",
  "expiry",
  "strike",
])
export class BrokerInstrument {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: number;

  @Column({ name: "broker_code", type: "varchar", length: 30 })
  brokerCode!: string;

  @Column({ type: "varchar", length: 20 })
  exchange!: string;

  @Column({ name: "broker_token", type: "varchar", length: 80 })
  brokerToken!: string;

  @Column({ type: "varchar", length: 80 })
  underlying!: string;

  @Column({ name: "trading_symbol", type: "varchar", length: 120 })
  tradingSymbol!: string;

  @Column({ name: "instrument_type", type: "varchar", length: 30 })
  instrumentType!: string;

  @Column({ name: "option_type", type: "varchar", length: 4, nullable: true })
  optionType!: string | null;

  @Column({ type: "numeric", precision: 18, scale: 6, nullable: true })
  strike!: number | null;

  @Column({ type: "date", nullable: true })
  expiry!: string | null;

  @Column({ name: "lot_size", type: "numeric", precision: 20, scale: 6 })
  lotSize!: number;

  @Column({ name: "tick_size", type: "numeric", precision: 18, scale: 8 })
  tickSize!: number;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  raw!: Record<string, unknown>;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ name: "last_seen_at", type: "timestamptz" })
  lastSeenAt!: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
