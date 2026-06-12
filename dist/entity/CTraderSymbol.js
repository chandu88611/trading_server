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
exports.CTraderSymbol = void 0;
const typeorm_1 = require("typeorm");
let CTraderSymbol = class CTraderSymbol {
};
exports.CTraderSymbol = CTraderSymbol;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], CTraderSymbol.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "user_id", type: "varchar", length: 255 }),
    __metadata("design:type", String)
], CTraderSymbol.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "env", type: "enum", enum: ["demo", "live"] }),
    __metadata("design:type", String)
], CTraderSymbol.prototype, "env", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "account_id", type: "integer" }),
    __metadata("design:type", Number)
], CTraderSymbol.prototype, "accountId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "symbol_name", type: "varchar", length: 50 }),
    __metadata("design:type", String)
], CTraderSymbol.prototype, "symbolName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "symbol_id", type: "integer" }),
    __metadata("design:type", Number)
], CTraderSymbol.prototype, "symbolId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "lot_size", type: "bigint", nullable: true }),
    __metadata("design:type", Object)
], CTraderSymbol.prototype, "lotSize", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "digits", type: "integer", nullable: true }),
    __metadata("design:type", Object)
], CTraderSymbol.prototype, "digits", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "pip_position", type: "integer", nullable: true }),
    __metadata("design:type", Object)
], CTraderSymbol.prototype, "pipPosition", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "sl_distance", type: "integer", nullable: true }),
    __metadata("design:type", Object)
], CTraderSymbol.prototype, "slDistance", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "tp_distance", type: "integer", nullable: true }),
    __metadata("design:type", Object)
], CTraderSymbol.prototype, "tpDistance", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "distance_set_in", type: "varchar", length: 40, nullable: true }),
    __metadata("design:type", Object)
], CTraderSymbol.prototype, "distanceSetIn", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at" }),
    __metadata("design:type", Date)
], CTraderSymbol.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at" }),
    __metadata("design:type", Date)
], CTraderSymbol.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "expires_at", type: "timestamp with time zone", nullable: true }),
    __metadata("design:type", Object)
], CTraderSymbol.prototype, "expiresAt", void 0);
exports.CTraderSymbol = CTraderSymbol = __decorate([
    (0, typeorm_1.Entity)({ name: "ctrader_symbols" }),
    (0, typeorm_1.Index)(["userId", "env", "accountId"], { unique: false })
], CTraderSymbol);
