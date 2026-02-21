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
exports.TradeSignalStatus = void 0;
const typeorm_1 = require("typeorm");
const TradeSignals_1 = require("./TradeSignals");
let TradeSignalStatus = class TradeSignalStatus {
};
exports.TradeSignalStatus = TradeSignalStatus;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], TradeSignalStatus.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "signal_id", type: "int" }),
    __metadata("design:type", Number)
], TradeSignalStatus.prototype, "tradeSignalId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => TradeSignals_1.TradeSignal, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "signal_id" }),
    __metadata("design:type", TradeSignals_1.TradeSignal)
], TradeSignalStatus.prototype, "tradeSignal", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20 }),
    __metadata("design:type", String)
], TradeSignalStatus.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "attempts", type: "int", default: 0 }),
    __metadata("design:type", Number)
], TradeSignalStatus.prototype, "attempts", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], TradeSignalStatus.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], TradeSignalStatus.prototype, "updatedAt", void 0);
exports.TradeSignalStatus = TradeSignalStatus = __decorate([
    (0, typeorm_1.Entity)({ name: "trade_signals_status" })
], TradeSignalStatus);
