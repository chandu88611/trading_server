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
exports.AlertSnapshot = void 0;
const typeorm_1 = require("typeorm");
const User_1 = require("./User");
const AdminStrategyTrade_1 = require("./AdminStrategyTrade");
const Strategy_1 = require("./Strategy");
const SubscriptionPlan_1 = require("./SubscriptionPlan");
const UserSubscription_1 = require("./UserSubscription");
let AlertSnapshot = class AlertSnapshot {
};
exports.AlertSnapshot = AlertSnapshot;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], AlertSnapshot.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20 }),
    __metadata("design:type", String)
], AlertSnapshot.prototype, "ticker", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 50, nullable: true }),
    __metadata("design:type", String)
], AlertSnapshot.prototype, "exchange", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 10, nullable: true }),
    __metadata("design:type", String)
], AlertSnapshot.prototype, "interval", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "bar_time", type: "timestamptz", nullable: true }),
    __metadata("design:type", Date)
], AlertSnapshot.prototype, "barTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "alert_time", type: "timestamptz", nullable: true }),
    __metadata("design:type", Date)
], AlertSnapshot.prototype, "alertTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 15, scale: 6, nullable: true }),
    __metadata("design:type", Number)
], AlertSnapshot.prototype, "open", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 15, scale: 6, nullable: true }),
    __metadata("design:type", Number)
], AlertSnapshot.prototype, "close", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 15, scale: 6, nullable: true }),
    __metadata("design:type", Number)
], AlertSnapshot.prototype, "high", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 15, scale: 6, nullable: true }),
    __metadata("design:type", Number)
], AlertSnapshot.prototype, "low", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 20, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], AlertSnapshot.prototype, "volume", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 10, nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "base_currency", type: "varchar", length: 10, nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "baseCurrency", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "execution_mode", type: "varchar", length: 20, nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "executionMode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "entry_ref", type: "varchar", length: 100, nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "entryRef", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "order_type", type: "varchar", length: 20, nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "orderType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "limit_price", type: "numeric", precision: 15, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "limitPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "stop_price", type: "numeric", precision: 15, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "stopPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "stop_loss", type: "numeric", precision: 15, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "stopLoss", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "take_profit", type: "numeric", precision: 15, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "takeProfit", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "stop_loss_distance", type: "numeric", precision: 15, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "stopLossDistance", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "take_profit_distance", type: "numeric", precision: 15, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "takeProfitDistance", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "stop_loss_amount", type: "numeric", precision: 15, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "stopLossAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "take_profit_amount", type: "numeric", precision: 15, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "takeProfitAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "trailing_stop_loss", type: "boolean", nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "trailingStopLoss", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "guaranteed_stop_loss", type: "boolean", nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "guaranteedStopLoss", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "stop_loss_trigger_method", type: "varchar", length: 30, nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "stopLossTriggerMethod", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "trailing_take_profit_activation_distance",
        type: "numeric",
        precision: 15,
        scale: 6,
        nullable: true,
    }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "trailingTakeProfitActivationDistance", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "trailing_take_profit_distance",
        type: "numeric",
        precision: 15,
        scale: 6,
        nullable: true,
    }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "trailingTakeProfitDistance", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "break_even_activation_distance",
        type: "numeric",
        precision: 15,
        scale: 6,
        nullable: true,
    }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "breakEvenActivationDistance", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "break_even_offset_distance",
        type: "numeric",
        precision: 15,
        scale: 6,
        nullable: true,
    }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "breakEvenOffsetDistance", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "trailing_stop_loss_distance",
        type: "numeric",
        precision: 15,
        scale: 6,
        nullable: true,
    }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "trailingStopLossDistance", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "trading_strength",
        type: "numeric",
        precision: 15,
        scale: 6,
        nullable: true,
    }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "tradingStrength", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "admin_strategy_trade_id", type: "bigint", nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "adminStrategyTradeId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => AdminStrategyTrade_1.AdminStrategyTrade, { onDelete: "SET NULL", nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: "admin_strategy_trade_id" }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "adminStrategyTrade", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "strategy_id", type: "bigint", nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "strategyId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Strategy_1.Strategy, { onDelete: "SET NULL", nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: "strategy_id" }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "strategy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "plan_id", type: "bigint", nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "planId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => SubscriptionPlan_1.SubscriptionPlan, { onDelete: "SET NULL", nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: "plan_id" }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "plan", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "subscription_id", type: "bigint", nullable: true }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "subscriptionId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => UserSubscription_1.UserSubscription, { onDelete: "SET NULL", nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: "subscription_id" }),
    __metadata("design:type", Object)
], AlertSnapshot.prototype, "subscription", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], AlertSnapshot.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], AlertSnapshot.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "user_id", type: "bigint" }),
    __metadata("design:type", Number)
], AlertSnapshot.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", User_1.User)
], AlertSnapshot.prototype, "user", void 0);
exports.AlertSnapshot = AlertSnapshot = __decorate([
    (0, typeorm_1.Entity)({ name: "alert_snapshots" }),
    (0, typeorm_1.Index)("idx_alert_snapshots_admin_strategy_trade_id", ["adminStrategyTradeId"]),
    (0, typeorm_1.Index)("idx_alert_snapshots_strategy_created_at", ["strategyId", "createdAt"])
], AlertSnapshot);
