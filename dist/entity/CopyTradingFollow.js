"use strict";
// import {
//   Column,
//   CreateDateColumn,
//   Entity,
//   Index,
//   JoinColumn,
//   ManyToOne,
//   PrimaryGeneratedColumn,
//   UpdateDateColumn,
// } from "typeorm";
// import { User } from "./User";
// import { UserTradingAccount } from "./UserTradingAccount";
// import { UserSubscription } from "./UserSubscription";
// import { CopyTradingMaster } from "./CopyTradingMaster";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopyTradingFollow = exports.CopyRiskMode = exports.CopyFollowStatus = void 0;
// export enum CopyFollowStatus {
//   PENDING = "pending",
//   ACTIVE = "active",
//   PAUSED = "paused",
//   STOPPED = "stopped",
//   REJECTED = "rejected",
// }
// export enum CopyRiskMode {
//   MULTIPLIER = "multiplier",
//   FIXED_LOT = "fixed_lot",
//   FIXED_RISK_PCT = "fixed_risk_pct",
// }
// @Entity({ name: "copy_trading_follows" })
// export class CopyTradingFollow {
//   @PrimaryGeneratedColumn("increment", { type: "bigint" })
//   id!: string;
//   @Column({ name: "master_id", type: "bigint" })
//   masterId!: string;
//   @ManyToOne(() => CopyTradingMaster, { onDelete: "CASCADE" })
//   @JoinColumn({ name: "master_id" })
//   master?: CopyTradingMaster;
//   @Column({ name: "follower_user_id", type: "bigint" })
//   followerUserId!: string;
//   @ManyToOne(() => User, { onDelete: "CASCADE" })
//   @JoinColumn({ name: "follower_user_id" })
//   followerUser?: User;
//   @Column({ name: "follower_trading_account_id", type: "bigint" })
//   followerTradingAccountId!: string;
//   @ManyToOne(() => UserTradingAccount, { onDelete: "CASCADE" })
//   @JoinColumn({ name: "follower_trading_account_id" })
//   followerTradingAccount?: UserTradingAccount;
//   @Column({ name: "subscription_id", type: "bigint", nullable: true })
//   subscriptionId!: string | null;
//   @ManyToOne(() => UserSubscription, { nullable: true, onDelete: "SET NULL" })
//   @JoinColumn({ name: "subscription_id" })
//   subscription?: UserSubscription | null;
//   @Column({
//     type: "enum",
//     enum: CopyFollowStatus,
//     enumName: "copy_follow_status",
//     default: CopyFollowStatus.ACTIVE,
//   })
//   status!: CopyFollowStatus;
//   @Column({
//     name: "risk_mode",
//     type: "enum",
//     enum: CopyRiskMode,
//     enumName: "copy_risk_mode",
//     default: CopyRiskMode.MULTIPLIER,
//   })
//   riskMode!: CopyRiskMode;
//   @Column({
//     name: "risk_value",
//     type: "numeric",
//     precision: 12,
//     scale: 4,
//     default: 1,
//   })
//   riskValue!: string;
//   @Column({
//     name: "max_lot",
//     type: "numeric",
//     precision: 12,
//     scale: 4,
//     nullable: true,
//   })
//   maxLot!: string | null;
//   @Column({ name: "max_open_positions", type: "int", nullable: true })
//   maxOpenPositions!: number | null;
//   @Column({
//     name: "max_daily_loss",
//     type: "numeric",
//     precision: 14,
//     scale: 2,
//     nullable: true,
//   })
//   maxDailyLoss!: string | null;
//   @Column({
//     name: "slippage_tolerance",
//     type: "numeric",
//     precision: 12,
//     scale: 4,
//     nullable: true,
//   })
//   slippageTolerance!: string | null;
//   @Column({
//     name: "symbol_whitelist",
//     type: "text",
//     array: true,
//     nullable: true,
//   })
//   symbolWhitelist!: string[] | null;
//   @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
//   metadata!: Record<string, any>;
//   @CreateDateColumn({ name: "requested_at", type: "timestamptz" })
//   requestedAt!: Date;
//   @Column({ name: "approved_at", type: "timestamptz", nullable: true })
//   approvedAt!: Date | null;
//   @Column({ name: "paused_at", type: "timestamptz", nullable: true })
//   pausedAt!: Date | null;
//   @Column({ name: "stopped_at", type: "timestamptz", nullable: true })
//   stoppedAt!: Date | null;
//   @CreateDateColumn({ name: "created_at", type: "timestamptz" })
//   createdAt!: Date;
//   @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
//   updatedAt!: Date;
// }
// src/entity/CopyTradingFollow.ts
const typeorm_1 = require("typeorm");
const User_1 = require("./User");
const UserTradingAccount_1 = require("./UserTradingAccount");
const UserSubscription_1 = require("./UserSubscription");
const CopyTradingMaster_1 = require("./CopyTradingMaster");
// If you already have these enums in your codebase, import them instead.
var CopyFollowStatus;
(function (CopyFollowStatus) {
    CopyFollowStatus["PENDING"] = "pending";
    CopyFollowStatus["ACTIVE"] = "active";
    CopyFollowStatus["PAUSED"] = "paused";
    CopyFollowStatus["STOPPED"] = "stopped";
    CopyFollowStatus["REJECTED"] = "rejected";
})(CopyFollowStatus || (exports.CopyFollowStatus = CopyFollowStatus = {}));
var CopyRiskMode;
(function (CopyRiskMode) {
    CopyRiskMode["MULTIPLIER"] = "multiplier";
    CopyRiskMode["FIXED_LOT"] = "fixed_lot";
    CopyRiskMode["FIXED_RISK_PCT"] = "fixed_risk_pct";
})(CopyRiskMode || (exports.CopyRiskMode = CopyRiskMode = {}));
let CopyTradingFollow = class CopyTradingFollow {
};
exports.CopyTradingFollow = CopyTradingFollow;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id" }),
    __metadata("design:type", Number)
], CopyTradingFollow.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "master_id", type: "bigint" }),
    __metadata("design:type", Number)
], CopyTradingFollow.prototype, "masterId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => CopyTradingMaster_1.CopyTradingMaster, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "master_id" }),
    __metadata("design:type", CopyTradingMaster_1.CopyTradingMaster)
], CopyTradingFollow.prototype, "master", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "follower_user_id", type: "bigint" }),
    __metadata("design:type", Number)
], CopyTradingFollow.prototype, "followerUserId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "follower_user_id" }),
    __metadata("design:type", User_1.User)
], CopyTradingFollow.prototype, "followerUser", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "follower_trading_account_id", type: "bigint" }),
    __metadata("design:type", Number)
], CopyTradingFollow.prototype, "followerTradingAccountId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => UserTradingAccount_1.UserTradingAccount, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "follower_trading_account_id" }),
    __metadata("design:type", UserTradingAccount_1.UserTradingAccount)
], CopyTradingFollow.prototype, "followerTradingAccount", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "subscription_id", type: "bigint", nullable: true }),
    __metadata("design:type", Object)
], CopyTradingFollow.prototype, "subscriptionId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => UserSubscription_1.UserSubscription, { onDelete: "SET NULL", nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: "subscription_id" }),
    __metadata("design:type", Object)
], CopyTradingFollow.prototype, "subscription", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "status",
        type: "enum",
        enum: CopyFollowStatus,
        // enumName: "copy_follow_status",
        default: CopyFollowStatus.ACTIVE,
    }),
    __metadata("design:type", String)
], CopyTradingFollow.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "risk_mode",
        type: "enum",
        enum: CopyRiskMode,
        // enumName: "copy_risk_mode",
        default: CopyRiskMode.MULTIPLIER,
    }),
    __metadata("design:type", String)
], CopyTradingFollow.prototype, "riskMode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "risk_value", type: "numeric", precision: 12, scale: 4, default: 1.0 }),
    __metadata("design:type", String)
], CopyTradingFollow.prototype, "riskValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "max_lot", type: "numeric", precision: 12, scale: 4, nullable: true }),
    __metadata("design:type", Object)
], CopyTradingFollow.prototype, "maxLot", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "max_open_positions", type: "int", nullable: true }),
    __metadata("design:type", Object)
], CopyTradingFollow.prototype, "maxOpenPositions", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "max_daily_loss", type: "numeric", precision: 14, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], CopyTradingFollow.prototype, "maxDailyLoss", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "slippage_tolerance", type: "numeric", precision: 12, scale: 4, nullable: true }),
    __metadata("design:type", Object)
], CopyTradingFollow.prototype, "slippageTolerance", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "symbol_whitelist", type: "text", array: true, nullable: true }),
    __metadata("design:type", Object)
], CopyTradingFollow.prototype, "symbolWhitelist", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "metadata", type: "jsonb", default: () => "'{}'::jsonb" }),
    __metadata("design:type", Object)
], CopyTradingFollow.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "requested_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], CopyTradingFollow.prototype, "requestedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "approved_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], CopyTradingFollow.prototype, "approvedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "paused_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], CopyTradingFollow.prototype, "pausedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "stopped_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], CopyTradingFollow.prototype, "stoppedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], CopyTradingFollow.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], CopyTradingFollow.prototype, "updatedAt", void 0);
exports.CopyTradingFollow = CopyTradingFollow = __decorate([
    (0, typeorm_1.Entity)({ name: "copy_trading_follows" })
], CopyTradingFollow);
