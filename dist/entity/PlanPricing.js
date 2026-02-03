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
exports.PlanPricing = void 0;
const typeorm_1 = require("typeorm");
const SubscriptionPlan_1 = require("./SubscriptionPlan");
const subscriberPlan_enum_1 = require("../app/subscriptionPlan/enums/subscriberPlan.enum");
let PlanPricing = class PlanPricing {
};
exports.PlanPricing = PlanPricing;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], PlanPricing.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)({ unique: true }),
    (0, typeorm_1.Column)({ name: "plan_id", type: "uuid" }),
    __metadata("design:type", String)
], PlanPricing.prototype, "planId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => SubscriptionPlan_1.SubscriptionPlan, (p) => p.pricing, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "plan_id" }),
    __metadata("design:type", SubscriptionPlan_1.SubscriptionPlan)
], PlanPricing.prototype, "plan", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "price_inr", type: "int" }),
    __metadata("design:type", Number)
], PlanPricing.prototype, "priceInr", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 10, default: "INR" }),
    __metadata("design:type", String)
], PlanPricing.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "interval",
        type: "enum",
        enum: subscriberPlan_enum_1.BillingInterval,
        enumName: "billing_interval",
        default: subscriberPlan_enum_1.BillingInterval.MONTHLY,
    }),
    __metadata("design:type", String)
], PlanPricing.prototype, "interval", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "is_free", type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], PlanPricing.prototype, "isFree", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], PlanPricing.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], PlanPricing.prototype, "updatedAt", void 0);
exports.PlanPricing = PlanPricing = __decorate([
    (0, typeorm_1.Entity)({ name: "plan_pricing" })
], PlanPricing);
