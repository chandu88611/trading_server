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
const typeorm_1 = require("typeorm");
const UserSubscription_1 = require("./UserSubscription");
const SubscriptionInvoice_1 = require("./SubscriptionInvoice");
const entity_enum_1 = require("./entity.enum");
let SubscriptionPlan = class SubscriptionPlan {
};
exports.SubscriptionPlan = SubscriptionPlan;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], SubscriptionPlan.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "plan_code", type: "text", unique: true }),
    __metadata("design:type", String)
], SubscriptionPlan.prototype, "planCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], SubscriptionPlan.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], SubscriptionPlan.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "price_cents", type: "int" }),
    __metadata("design:type", Number)
], SubscriptionPlan.prototype, "priceCents", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 10, default: "INR" }),
    __metadata("design:type", String)
], SubscriptionPlan.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: entity_enum_1.BillingInterval,
        default: "monthly",
    }),
    __metadata("design:type", String)
], SubscriptionPlan.prototype, "interval", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "is_active", type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], SubscriptionPlan.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
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
