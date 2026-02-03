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
exports.SubscriptionPlan = void 0;
// src/entity/SubscriptionPlan.ts
const typeorm_1 = require("typeorm");
const PlanType_1 = require("./PlanType");
const Market_1 = require("./Market");
const PlanPricing_1 = require("./PlanPricing");
const PlanLimits_1 = require("./PlanLimits");
const PlanFeature_1 = require("./PlanFeature");
const PlanBundleItem_1 = require("./PlanBundleItem");
const UserSubscription_1 = require("./UserSubscription");
const SubscriptionInvoice_1 = require("./SubscriptionInvoice");
const PlanStrategy_1 = require("./PlanStrategy");
let SubscriptionPlan = class SubscriptionPlan {
};
exports.SubscriptionPlan = SubscriptionPlan;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], SubscriptionPlan.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "plan_type_id", type: "bigint" }),
    __metadata("design:type", String)
], SubscriptionPlan.prototype, "planTypeId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "market_id", type: "bigint", nullable: true }),
    __metadata("design:type", Object)
], SubscriptionPlan.prototype, "marketId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => PlanType_1.PlanType, (t) => t.plans, { onDelete: "RESTRICT" }),
    (0, typeorm_1.JoinColumn)({ name: "plan_type_id" }),
    __metadata("design:type", PlanType_1.PlanType)
], SubscriptionPlan.prototype, "planType", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Market_1.Market, (m) => m.plans, { onDelete: "RESTRICT", nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: "market_id" }),
    __metadata("design:type", Object)
], SubscriptionPlan.prototype, "market", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], SubscriptionPlan.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], SubscriptionPlan.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "is_active", type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], SubscriptionPlan.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "metadata",
        type: "jsonb",
        nullable: false,
        default: () => "'{}'::jsonb",
    }),
    __metadata("design:type", Object)
], SubscriptionPlan.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], SubscriptionPlan.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], SubscriptionPlan.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => PlanPricing_1.PlanPricing, (p) => p.plan),
    __metadata("design:type", PlanPricing_1.PlanPricing)
], SubscriptionPlan.prototype, "pricing", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => PlanLimits_1.PlanLimits, (l) => l.plan),
    __metadata("design:type", PlanLimits_1.PlanLimits)
], SubscriptionPlan.prototype, "limits", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => PlanFeature_1.PlanFeature, (f) => f.plan),
    __metadata("design:type", Array)
], SubscriptionPlan.prototype, "features", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => PlanBundleItem_1.PlanBundleItem, (bi) => bi.bundlePlan),
    __metadata("design:type", Array)
], SubscriptionPlan.prototype, "bundleItems", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => PlanBundleItem_1.PlanBundleItem, (bi) => bi.includedPlan),
    __metadata("design:type", Array)
], SubscriptionPlan.prototype, "includedInBundles", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => PlanStrategy_1.PlanStrategy, (ps) => ps.plan),
    __metadata("design:type", Array)
], SubscriptionPlan.prototype, "planStrategies", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => UserSubscription_1.UserSubscription, (sub) => sub.plan),
    __metadata("design:type", Array)
], SubscriptionPlan.prototype, "userSubscriptions", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => SubscriptionInvoice_1.SubscriptionInvoice, (inv) => inv.plan),
    __metadata("design:type", Array)
], SubscriptionPlan.prototype, "invoices", void 0);
exports.SubscriptionPlan = SubscriptionPlan = __decorate([
    (0, typeorm_1.Entity)({ name: "subscription_plans" })
], SubscriptionPlan);
