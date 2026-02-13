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
exports.CTradeSignalStatus = exports.CTradeSignal = void 0;
const typeorm_1 = require("typeorm");
const BrokerJob_1 = require("./BrokerJob");
const trade_identify_1 = require("../types/trade-identify");
let CTradeSignal = class CTradeSignal {
};
exports.CTradeSignal = CTradeSignal;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], CTradeSignal.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "job_id", type: "int" }),
    __metadata("design:type", Number)
], CTradeSignal.prototype, "jobId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => BrokerJob_1.BrokerJob, (bj) => bj.tradeSignals, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "job_id" }),
    __metadata("design:type", BrokerJob_1.BrokerJob)
], CTradeSignal.prototype, "brokerJob", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 10 }),
    __metadata("design:type", String)
], CTradeSignal.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20 }),
    __metadata("design:type", String)
], CTradeSignal.prototype, "symbol", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 10, scale: 5 }),
    __metadata("design:type", Number)
], CTradeSignal.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 50 }),
    __metadata("design:type", String)
], CTradeSignal.prototype, "exchange", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "asset_type", type: "varchar", length: 20, enum: trade_identify_1.AssetType }),
    __metadata("design:type", String)
], CTradeSignal.prototype, "assetType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "signal_time", type: "timestamptz" }),
    __metadata("design:type", Date)
], CTradeSignal.prototype, "signalTime", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], CTradeSignal.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], CTradeSignal.prototype, "updatedAt", void 0);
exports.CTradeSignal = CTradeSignal = __decorate([
    (0, typeorm_1.Entity)({ name: "c_trade_signals" })
], CTradeSignal);
let CTradeSignalStatus = class CTradeSignalStatus {
};
exports.CTradeSignalStatus = CTradeSignalStatus;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], CTradeSignalStatus.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "signal_id", type: "int" }),
    __metadata("design:type", Number)
], CTradeSignalStatus.prototype, "tradeSignalId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => CTradeSignal, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "signal_id" }),
    __metadata("design:type", CTradeSignal)
], CTradeSignalStatus.prototype, "tradeSignal", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20 }),
    __metadata("design:type", String)
], CTradeSignalStatus.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], CTradeSignalStatus.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], CTradeSignalStatus.prototype, "updatedAt", void 0);
exports.CTradeSignalStatus = CTradeSignalStatus = __decorate([
    (0, typeorm_1.Entity)({ name: "c_trade_signals_status" })
], CTradeSignalStatus);
