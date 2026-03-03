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
    __metadata("design:type", Number)
], Strategy.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "strategy_code", type: "text", unique: true }),
    __metadata("design:type", String)
], Strategy.prototype, "strategyCode", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "name", type: "text" }),
    __metadata("design:type", String)
], Strategy.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "description", type: "text", nullable: true }),
    __metadata("design:type", Object)
], Strategy.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "category", type: "varchar" }),
    __metadata("design:type", String)
], Strategy.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "version", type: "int", default: 1 }),
    __metadata("design:type", Number)
], Strategy.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "default_params",
        type: "jsonb",
        nullable: false,
        default: () => "'{}'::jsonb",
    }),
    __metadata("design:type", Object)
], Strategy.prototype, "defaultParams", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "risk_profile", type: "text", nullable: true }),
    __metadata("design:type", Object)
], Strategy.prototype, "riskProfile", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "capital_requirement", type: "numeric", precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], Strategy.prototype, "capitalRequirement", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "is_active", type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], Strategy.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "is_deprecated", type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], Strategy.prototype, "isDeprecated", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "is_copyable", type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], Strategy.prototype, "isCopyable", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], Strategy.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], Strategy.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => PlanStrategy_1.PlanStrategy, (ps) => ps.strategy),
    __metadata("design:type", Array)
], Strategy.prototype, "planStrategies", void 0);
exports.Strategy = Strategy = __decorate([
    (0, typeorm_1.Entity)({ name: "strategies" })
], Strategy);
