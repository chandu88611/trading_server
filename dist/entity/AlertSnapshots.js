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
    (0, typeorm_1.Entity)({ name: "alert_snapshots" })
], AlertSnapshot);
