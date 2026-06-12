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
exports.TradeSignal = void 0;
const typeorm_1 = require("typeorm");
const trade_identify_1 = require("../types/trade-identify");
const User_1 = require("./User");
const UserTradingAccount_1 = require("./UserTradingAccount");
const AlertSnapshots_1 = require("./AlertSnapshots");
const TradeSignalsStatus_1 = require("./TradeSignalsStatus");
const AdminStrategyTrade_1 = require("./AdminStrategyTrade");
const Strategy_1 = require("./Strategy");
const SubscriptionPlan_1 = require("./SubscriptionPlan");
const UserSubscription_1 = require("./UserSubscription");
let TradeSignal = class TradeSignal {
};
exports.TradeSignal = TradeSignal;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], TradeSignal.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 10 }),
    __metadata("design:type", String)
], TradeSignal.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20 }),
    __metadata("design:type", String)
], TradeSignal.prototype, "symbol", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 10, scale: 5 }),
    __metadata("design:type", Number)
], TradeSignal.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 50 }),
    __metadata("design:type", String)
], TradeSignal.prototype, "exchange", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "asset_type", type: "varchar", length: 20, enum: trade_identify_1.AssetType }),
    __metadata("design:type", String)
], TradeSignal.prototype, "assetType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "instrument_type", type: "varchar", length: 20, nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "instrumentType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "product", type: "varchar", length: 20, nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "product", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "underlying", type: "varchar", length: 40, nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "underlying", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "expiry", type: "date", nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "expiry", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "option_type", type: "varchar", length: 4, nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "optionType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "strike", type: "numeric", precision: 15, scale: 4, nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "strike", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "trading_symbol", type: "varchar", length: 60, nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "tradingSymbol", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "signal_time", type: "timestamptz" }),
    __metadata("design:type", Date)
], TradeSignal.prototype, "signalTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "volume", type: "numeric", precision: 20, scale: 2 }),
    __metadata("design:type", Number)
], TradeSignal.prototype, "volume", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "order_id", type: "bigint", nullable: true }),
    __metadata("design:type", Number)
], TradeSignal.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "execution_mode", type: "varchar", length: 20, nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "executionMode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "entry_ref", type: "varchar", length: 100, nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "entryRef", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "order_type", type: "varchar", length: 20, nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "orderType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "limit_price", type: "numeric", precision: 15, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "limitPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "stop_price", type: "numeric", precision: 15, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "stopPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "stop_loss", type: "numeric", precision: 15, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "stopLoss", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "take_profit", type: "numeric", precision: 15, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "takeProfit", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "stop_loss_distance", type: "numeric", precision: 15, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "stopLossDistance", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "take_profit_distance", type: "numeric", precision: 15, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "takeProfitDistance", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "stop_loss_amount", type: "numeric", precision: 15, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "stopLossAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "take_profit_amount", type: "numeric", precision: 15, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "takeProfitAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "trailing_stop_loss", type: "boolean", nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "trailingStopLoss", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "guaranteed_stop_loss", type: "boolean", nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "guaranteedStopLoss", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "stop_loss_trigger_method", type: "varchar", length: 30, nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "stopLossTriggerMethod", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "trailing_take_profit_activation_distance",
        type: "numeric",
        precision: 15,
        scale: 6,
        nullable: true,
    }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "trailingTakeProfitActivationDistance", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "trailing_take_profit_distance",
        type: "numeric",
        precision: 15,
        scale: 6,
        nullable: true,
    }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "trailingTakeProfitDistance", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "break_even_activation_distance",
        type: "numeric",
        precision: 15,
        scale: 6,
        nullable: true,
    }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "breakEvenActivationDistance", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "break_even_offset_distance",
        type: "numeric",
        precision: 15,
        scale: 6,
        nullable: true,
    }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "breakEvenOffsetDistance", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "trailing_stop_loss_distance",
        type: "numeric",
        precision: 15,
        scale: 6,
        nullable: true,
    }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "trailingStopLossDistance", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "broker_order_id", type: "bigint", nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "brokerOrderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "broker_position_id", type: "bigint", nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "brokerPositionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "admin_strategy_trade_id", type: "bigint", nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "adminStrategyTradeId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => AdminStrategyTrade_1.AdminStrategyTrade, { onDelete: "SET NULL", nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: "admin_strategy_trade_id" }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "adminStrategyTrade", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "strategy_id", type: "bigint", nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "strategyId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Strategy_1.Strategy, { onDelete: "SET NULL", nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: "strategy_id" }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "strategy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "plan_id", type: "bigint", nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "planId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => SubscriptionPlan_1.SubscriptionPlan, { onDelete: "SET NULL", nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: "plan_id" }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "plan", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "subscription_id", type: "bigint", nullable: true }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "subscriptionId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => UserSubscription_1.UserSubscription, { onDelete: "SET NULL", nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: "subscription_id" }),
    __metadata("design:type", Object)
], TradeSignal.prototype, "subscription", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], TradeSignal.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], TradeSignal.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "user_id", type: "bigint" }),
    __metadata("design:type", Number)
], TradeSignal.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", User_1.User)
], TradeSignal.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "trading_account_id", type: "bigint" }),
    __metadata("design:type", Number)
], TradeSignal.prototype, "tradingAccountId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => UserTradingAccount_1.UserTradingAccount, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "trading_account_id" }),
    __metadata("design:type", UserTradingAccount_1.UserTradingAccount)
], TradeSignal.prototype, "tradingAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "alert_snapshots_id", type: "bigint" }),
    __metadata("design:type", Number)
], TradeSignal.prototype, "alertSnapshotsId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => AlertSnapshots_1.AlertSnapshot, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "alert_snapshots_id" }),
    __metadata("design:type", AlertSnapshots_1.AlertSnapshot)
], TradeSignal.prototype, "alertSnapshot", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => TradeSignalsStatus_1.TradeSignalStatus, (status) => status.tradeSignal),
    __metadata("design:type", TradeSignalsStatus_1.TradeSignalStatus)
], TradeSignal.prototype, "status", void 0);
exports.TradeSignal = TradeSignal = __decorate([
    (0, typeorm_1.Entity)({ name: "trade_signals" }),
    (0, typeorm_1.Index)("idx_trade_signals_trading_account_entry_ref_created_at", ["tradingAccountId", "entryRef", "createdAt"]),
    (0, typeorm_1.Index)("idx_trade_signals_entry_ref_execution_mode", ["entryRef", "executionMode"]),
    (0, typeorm_1.Index)("idx_trade_signals_admin_strategy_trade_status", ["adminStrategyTradeId", "createdAt"]),
    (0, typeorm_1.Index)("idx_trade_signals_strategy_created_at", ["strategyId", "createdAt"])
], TradeSignal);
