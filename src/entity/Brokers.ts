import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";


@Entity({ name: "brokers" })
export class Broker {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "text", unique: true, name: "code" })
    code!: string;

    @Column({ type: "text", name: "name" })
    name!: string;

    @Column({ type: "varchar", name: "market_category" })
    marketCategory!: string;

    @Column({ type: "boolean", name: "is_active", default: true })
    isActive!: boolean;

    @CreateDateColumn({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;
    
    @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;
}