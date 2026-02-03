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
exports.PlanFeature = void 0;
const typeorm_1 = require("typeorm");
const SubscriptionPlan_1 = require("./SubscriptionPlan");
let PlanFeature = class PlanFeature {
};
exports.PlanFeature = PlanFeature;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], PlanFeature.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "plan_id", type: "uuid" }),
    __metadata("design:type", String)
], PlanFeature.prototype, "planId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => SubscriptionPlan_1.SubscriptionPlan, (p) => p.features, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "plan_id" }),
    __metadata("design:type", SubscriptionPlan_1.SubscriptionPlan)
], PlanFeature.prototype, "plan", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "feature_key", type: "text" }),
    __metadata("design:type", String)
], PlanFeature.prototype, "featureKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "feature_value", type: "text" }),
    __metadata("design:type", String)
], PlanFeature.prototype, "featureValue", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], PlanFeature.prototype, "createdAt", void 0);
exports.PlanFeature = PlanFeature = __decorate([
    (0, typeorm_1.Entity)({ name: "plan_features" }),
    (0, typeorm_1.Index)(["planId", "featureKey"], { unique: true })
], PlanFeature);
