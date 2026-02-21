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
exports.PlanBundleItem = void 0;
const typeorm_1 = require("typeorm");
const SubscriptionPlan_1 = require("./SubscriptionPlan");
let PlanBundleItem = class PlanBundleItem {
};
exports.PlanBundleItem = PlanBundleItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], PlanBundleItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "bundle_plan_id", type: "bigint" }),
    __metadata("design:type", Number)
], PlanBundleItem.prototype, "bundlePlanId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "included_plan_id", type: "bigint" }),
    __metadata("design:type", Number)
], PlanBundleItem.prototype, "includedPlanId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => SubscriptionPlan_1.SubscriptionPlan, (p) => p.bundleItems, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "bundle_plan_id" }),
    __metadata("design:type", SubscriptionPlan_1.SubscriptionPlan)
], PlanBundleItem.prototype, "bundlePlan", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => SubscriptionPlan_1.SubscriptionPlan, (p) => p.includedInBundles, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "included_plan_id" }),
    __metadata("design:type", SubscriptionPlan_1.SubscriptionPlan)
], PlanBundleItem.prototype, "includedPlan", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int", default: 1 }),
    __metadata("design:type", Number)
], PlanBundleItem.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], PlanBundleItem.prototype, "createdAt", void 0);
exports.PlanBundleItem = PlanBundleItem = __decorate([
    (0, typeorm_1.Entity)({ name: "plan_bundle_items" }),
    (0, typeorm_1.Index)(["bundlePlanId", "includedPlanId"], { unique: true }),
    (0, typeorm_1.Check)(`"bundle_plan_id" <> "included_plan_id"`)
], PlanBundleItem);
