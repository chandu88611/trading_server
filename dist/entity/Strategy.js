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
exports.Strategy = void 0;
const typeorm_1 = require("typeorm");
const PlanStrategy_1 = require("./PlanStrategy");
let Strategy = class Strategy {
};
exports.Strategy = Strategy;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: "bigint" }),
    __metadata("design:type", String)
], Strategy.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: "varchar", length: 120 }),
    __metadata("design:type", String)
], Strategy.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], Strategy.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: "varchar", length: 60 }),
    __metadata("design:type", String)
], Strategy.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 16, default: "Medium" }),
    __metadata("design:type", String)
], Strategy.prototype, "risk", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { array: true, default: () => "ARRAY[]::text[]" }),
    __metadata("design:type", Array)
], Strategy.prototype, "marketCodes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 8, scale: 2, default: 0 }),
    __metadata("design:type", String)
], Strategy.prototype, "avgMonthlyReturnPct", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 6, scale: 2, default: 0 }),
    __metadata("design:type", String)
], Strategy.prototype, "winRatePct", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 6, scale: 2, default: 0 }),
    __metadata("design:type", String)
], Strategy.prototype, "maxDrawdownPct", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], Strategy.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Strategy.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Strategy.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => PlanStrategy_1.PlanStrategy, (ps) => ps.strategy),
    __metadata("design:type", Array)
], Strategy.prototype, "planStrategies", void 0);
exports.Strategy = Strategy = __decorate([
    (0, typeorm_1.Entity)({ name: "strategies" })
], Strategy);
