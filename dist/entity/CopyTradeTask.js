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
exports.CopyTradeTask = exports.CopyTaskStatus = void 0;
const typeorm_1 = require("typeorm");
const CopyMasterEvent_1 = require("./CopyMasterEvent");
const CopyTradingFollow_1 = require("./CopyTradingFollow");
var CopyTaskStatus;
(function (CopyTaskStatus) {
    CopyTaskStatus["QUEUED"] = "queued";
    CopyTaskStatus["SENT"] = "sent";
    CopyTaskStatus["EXECUTED"] = "executed";
    CopyTaskStatus["FAILED"] = "failed";
    CopyTaskStatus["SKIPPED"] = "skipped";
    CopyTaskStatus["CANCELLED"] = "cancelled";
})(CopyTaskStatus || (exports.CopyTaskStatus = CopyTaskStatus = {}));
let CopyTradeTask = class CopyTradeTask {
};
exports.CopyTradeTask = CopyTradeTask;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("increment", { type: "bigint" }),
    __metadata("design:type", String)
], CopyTradeTask.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "master_event_id", type: "bigint" }),
    __metadata("design:type", String)
], CopyTradeTask.prototype, "masterEventId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => CopyMasterEvent_1.CopyMasterEvent, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "master_event_id" }),
    __metadata("design:type", CopyMasterEvent_1.CopyMasterEvent)
], CopyTradeTask.prototype, "masterEvent", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "follow_id", type: "bigint" }),
    __metadata("design:type", String)
], CopyTradeTask.prototype, "followId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => CopyTradingFollow_1.CopyTradingFollow, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "follow_id" }),
    __metadata("design:type", CopyTradingFollow_1.CopyTradingFollow)
], CopyTradeTask.prototype, "follow", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: CopyTaskStatus,
        enumName: "copy_task_status",
        default: CopyTaskStatus.QUEUED,
    }),
    __metadata("design:type", String)
], CopyTradeTask.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int", default: 0 }),
    __metadata("design:type", Number)
], CopyTradeTask.prototype, "attempts", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "last_error", type: "text", nullable: true }),
    __metadata("design:type", Object)
], CopyTradeTask.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "follower_order_ref", type: "text", nullable: true }),
    __metadata("design:type", Object)
], CopyTradeTask.prototype, "followerOrderRef", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "follower_position_ref", type: "text", nullable: true }),
    __metadata("design:type", Object)
], CopyTradeTask.prototype, "followerPositionRef", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "executed_quantity",
        type: "numeric",
        precision: 30,
        scale: 8,
        nullable: true,
    }),
    __metadata("design:type", Object)
], CopyTradeTask.prototype, "executedQuantity", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "executed_price",
        type: "numeric",
        precision: 30,
        scale: 8,
        nullable: true,
    }),
    __metadata("design:type", Object)
], CopyTradeTask.prototype, "executedPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "executed_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], CopyTradeTask.prototype, "executedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "latency_ms", type: "int", nullable: true }),
    __metadata("design:type", Object)
], CopyTradeTask.prototype, "latencyMs", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", default: () => "'{}'::jsonb" }),
    __metadata("design:type", Object)
], CopyTradeTask.prototype, "payload", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], CopyTradeTask.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], CopyTradeTask.prototype, "updatedAt", void 0);
exports.CopyTradeTask = CopyTradeTask = __decorate([
    (0, typeorm_1.Entity)({ name: "copy_trade_tasks" })
], CopyTradeTask);
