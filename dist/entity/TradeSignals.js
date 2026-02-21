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
    (0, typeorm_1.Entity)({ name: "trade_signals" })
], TradeSignal);
