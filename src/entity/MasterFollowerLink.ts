import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from "typeorm";
import { UserTradingAccount } from "./UserTradingAccount";
export type AllocationType = "PROPORTIONAL_EQUITY" | "MULTIPLIER";
@Entity({ name: "master_follower_links" })
@Index("uq_mam_master_follower", ["masterAccountId", "followerAccountId"], { unique: true })
export class MasterFollowerLink {
  @PrimaryGeneratedColumn() id!: number;
  @Column({name:"master_account_id",type:"bigint"}) masterAccountId!: number;
  @Column({name:"follower_account_id",type:"bigint"}) followerAccountId!: number;
  @ManyToOne(()=>UserTradingAccount,{onDelete:"CASCADE"}) @JoinColumn({name:"master_account_id"}) masterAccount!: UserTradingAccount;
  @ManyToOne(()=>UserTradingAccount,{onDelete:"CASCADE"}) @JoinColumn({name:"follower_account_id"}) followerAccount!: UserTradingAccount;
  @Column({name:"allocation_type",type:"varchar",length:30,default:"MULTIPLIER"}) allocationType!: AllocationType;
  @Column({type:"numeric",precision:28,scale:8,default:1}) multiplier!: number;
  @Column({name:"max_allocation_lots",type:"numeric",precision:28,scale:8,nullable:true}) maxAllocationLots!: number | null;
  @Column({name:"is_active",type:"boolean",default:true}) isActive!: boolean;
  @CreateDateColumn({name:"created_at",type:"timestamptz"}) createdAt!: Date;
  // Tombstone prevents an unlinked legacy relationship from reappearing during fanout/backfill.
  @Column({name:"deleted_at",type:"timestamptz",nullable:true}) deletedAt!: Date | null;
}
