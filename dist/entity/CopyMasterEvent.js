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
exports.CopyMasterEvent = exports.CopyTradeSide = exports.CopyEventType = void 0;
const typeorm_1 = require("typeorm");
const CopyTradingMaster_1 = require("./CopyTradingMaster");
var CopyEventType;
(function (CopyEventType) {
    CopyEventType["OPEN"] = "OPEN";
    CopyEventType["CLOSE"] = "CLOSE";
    CopyEventType["MODIFY"] = "MODIFY";
    CopyEventType["PARTIAL_CLOSE"] = "PARTIAL_CLOSE";
})(CopyEventType || (exports.CopyEventType = CopyEventType = {}));
var CopyTradeSide;
(function (CopyTradeSide) {
    CopyTradeSide["BUY"] = "BUY";
    CopyTradeSide["SELL"] = "SELL";
})(CopyTradeSide || (exports.CopyTradeSide = CopyTradeSide = {}));
let CopyMasterEvent = class CopyMasterEvent {
};
exports.CopyMasterEvent = CopyMasterEvent;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("increment", { type: "bigint" }),
    __metadata("design:type", Number)
], CopyMasterEvent.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "master_id", type: "bigint" }),
    __metadata("design:type", Number)
], CopyMasterEvent.prototype, "masterId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => CopyTradingMaster_1.CopyTradingMaster, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "master_id" }),
    __metadata("design:type", CopyTradingMaster_1.CopyTradingMaster)
], CopyMasterEvent.prototype, "master", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "event_type",
        type: "enum",
        enum: CopyEventType,
        enumName: "copy_event_type",
    }),
    __metadata("design:type", String)
], CopyMasterEvent.prototype, "eventType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 64 }),
    __metadata("design:type", String)
], CopyMasterEvent.prototype, "symbol", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: CopyTradeSide,
        enumName: "copy_trade_side",
        nullable: true,
    }),
    __metadata("design:type", Object)
], CopyMasterEvent.prototype, "side", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 30, scale: 8, nullable: true }),
    __metadata("design:type", Object)
], CopyMasterEvent.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 30, scale: 8, nullable: true }),
    __metadata("design:type", Object)
], CopyMasterEvent.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 30, scale: 8, nullable: true }),
    __metadata("design:type", Object)
], CopyMasterEvent.prototype, "sl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 30, scale: 8, nullable: true }),
    __metadata("design:type", Object)
], CopyMasterEvent.prototype, "tp", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "master_order_ref", type: "text", nullable: true }),
    __metadata("design:type", Object)
], CopyMasterEvent.prototype, "masterOrderRef", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "master_position_ref", type: "text", nullable: true }),
    __metadata("design:type", Object)
], CopyMasterEvent.prototype, "masterPositionRef", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "signal_time", type: "timestamptz", default: () => "now()" }),
    __metadata("design:type", Date)
], CopyMasterEvent.prototype, "signalTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", default: () => "'{}'::jsonb" }),
    __metadata("design:type", Object)
], CopyMasterEvent.prototype, "payload", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], CopyMasterEvent.prototype, "createdAt", void 0);
exports.CopyMasterEvent = CopyMasterEvent = __decorate([
    (0, typeorm_1.Entity)({ name: "copy_master_events" })
], CopyMasterEvent);
