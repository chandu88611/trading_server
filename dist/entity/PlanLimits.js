"use strict";
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
exports.PlanLimits = void 0;
const typeorm_1 = require("typeorm");
const SubscriptionPlan_1 = require("./SubscriptionPlan");
let PlanLimits = class PlanLimits {
};
exports.PlanLimits = PlanLimits;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], PlanLimits.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)({ unique: true }),
    (0, typeorm_1.Column)({ name: "plan_id", type: "bigint" }),
    __metadata("design:type", Number)
], PlanLimits.prototype, "planId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => SubscriptionPlan_1.SubscriptionPlan, (p) => p.limits, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "plan_id" }),
    __metadata("design:type", SubscriptionPlan_1.SubscriptionPlan)
], PlanLimits.prototype, "plan", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "min_balance", type: "numeric", precision: 14, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], PlanLimits.prototype, "minBalance", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "max_trades_per_week", type: "int", nullable: true }),
    __metadata("design:type", Object)
], PlanLimits.prototype, "maxTradesPerWeek", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "max_connected_accounts", type: "int", nullable: true }),
    __metadata("design:type", Object)
], PlanLimits.prototype, "maxConnectedAccounts", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "max_daily_trades", type: "int", nullable: true }),
    __metadata("design:type", Object)
], PlanLimits.prototype, "maxDailyTrades", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "max_lot_per_trade", type: "numeric", precision: 12, scale: 4, nullable: true }),
    __metadata("design:type", Object)
], PlanLimits.prototype, "maxLotPerTrade", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "max_copy_masters", type: "int", nullable: true }),
    __metadata("design:type", Object)
], PlanLimits.prototype, "maxCopyMasters", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "max_copy_following_accounts", type: "int", nullable: true }),
    __metadata("design:type", Object)
], PlanLimits.prototype, "maxCopyFollowingAccounts", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "max_copy_followers_per_master", type: "int", nullable: true }),
    __metadata("design:type", Object)
], PlanLimits.prototype, "maxCopyFollowersPerMaster", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], PlanLimits.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], PlanLimits.prototype, "updatedAt", void 0);
exports.PlanLimits = PlanLimits = __decorate([
    (0, typeorm_1.Entity)({ name: "plan_limits" })
], PlanLimits);
