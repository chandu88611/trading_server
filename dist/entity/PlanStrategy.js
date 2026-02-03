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
exports.PlanStrategy = void 0;
// src/entity/PlanStrategy.ts
const typeorm_1 = require("typeorm");
const SubscriptionPlan_1 = require("./SubscriptionPlan");
const Strategy_1 = require("./Strategy");
let PlanStrategy = class PlanStrategy {
};
exports.PlanStrategy = PlanStrategy;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: "bigint" }),
    __metadata("design:type", String)
], PlanStrategy.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "plan_id", type: "uuid" }),
    __metadata("design:type", String)
], PlanStrategy.prototype, "planId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "strategy_id", type: "bigint" }),
    __metadata("design:type", String)
], PlanStrategy.prototype, "strategyId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => SubscriptionPlan_1.SubscriptionPlan, (p) => p.planStrategies, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "plan_id" }),
    __metadata("design:type", SubscriptionPlan_1.SubscriptionPlan)
], PlanStrategy.prototype, "plan", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Strategy_1.Strategy, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "strategy_id" }),
    __metadata("design:type", Strategy_1.Strategy)
], PlanStrategy.prototype, "strategy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], PlanStrategy.prototype, "createdAt", void 0);
exports.PlanStrategy = PlanStrategy = __decorate([
    (0, typeorm_1.Entity)({ name: "plan_strategies" }),
    (0, typeorm_1.Index)(["planId", "strategyId"], { unique: true })
], PlanStrategy);
