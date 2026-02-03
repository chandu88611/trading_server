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
exports.BrokerJob = void 0;
const typeorm_1 = require("typeorm");
const BrokerCredential_1 = require("./BrokerCredential");
const TradeSignals_1 = require("./TradeSignals");
const AlertSnapshots_1 = require("./AlertSnapshots");
let BrokerJob = class BrokerJob {
};
exports.BrokerJob = BrokerJob;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], BrokerJob.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => BrokerCredential_1.BrokerCredential, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "credential_id" }),
    __metadata("design:type", BrokerCredential_1.BrokerCredential)
], BrokerJob.prototype, "credential", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], BrokerJob.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], BrokerJob.prototype, "payload", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int", default: 0 }),
    __metadata("design:type", Number)
], BrokerJob.prototype, "attempts", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "last_error", type: "text", nullable: true }),
    __metadata("design:type", Object)
], BrokerJob.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", default: "pending" }),
    __metadata("design:type", String)
], BrokerJob.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], BrokerJob.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], BrokerJob.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => TradeSignals_1.TradeSignal, (ts) => ts.brokerJob),
    __metadata("design:type", Array)
], BrokerJob.prototype, "tradeSignals", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => AlertSnapshots_1.AlertSnapshot, (as) => as.brokerJob),
    __metadata("design:type", Array)
], BrokerJob.prototype, "alertSnapshots", void 0);
exports.BrokerJob = BrokerJob = __decorate([
    (0, typeorm_1.Entity)({ name: "broker_jobs" }),
    (0, typeorm_1.Index)(["credential", "status"])
], BrokerJob);
