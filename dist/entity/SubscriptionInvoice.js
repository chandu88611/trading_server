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
exports.SubscriptionInvoice = void 0;
const typeorm_1 = require("typeorm");
const User_1 = require("./User");
const SubscriptionPlan_1 = require("./SubscriptionPlan");
const UserSubscription_1 = require("./UserSubscription");
let SubscriptionInvoice = class SubscriptionInvoice {
};
exports.SubscriptionInvoice = SubscriptionInvoice;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], SubscriptionInvoice.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "subscription_id", type: "bigint" }),
    __metadata("design:type", Number)
], SubscriptionInvoice.prototype, "subscriptionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "user_id", type: "bigint" }),
    __metadata("design:type", Number)
], SubscriptionInvoice.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "plan_id", type: "bigint" }),
    __metadata("design:type", Number)
], SubscriptionInvoice.prototype, "planId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "amount_cents", type: "int" }),
    __metadata("design:type", Number)
], SubscriptionInvoice.prototype, "amountCents", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 10, default: "INR" }),
    __metadata("design:type", String)
], SubscriptionInvoice.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", default: "pending" }),
    __metadata("design:type", String)
], SubscriptionInvoice.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "billing_period_start",
        type: "timestamptz",
    }),
    __metadata("design:type", Date)
], SubscriptionInvoice.prototype, "billingPeriodStart", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "billing_period_end",
        type: "timestamptz",
    }),
    __metadata("design:type", Date)
], SubscriptionInvoice.prototype, "billingPeriodEnd", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "payment_gateway", type: "text", nullable: true }),
    __metadata("design:type", Object)
], SubscriptionInvoice.prototype, "paymentGateway", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "payment_reference", type: "text", nullable: true }),
    __metadata("design:type", Object)
], SubscriptionInvoice.prototype, "paymentReference", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], SubscriptionInvoice.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], SubscriptionInvoice.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => UserSubscription_1.UserSubscription, (sub) => sub.id, {
        onDelete: "CASCADE",
    }),
    (0, typeorm_1.JoinColumn)({ name: "subscription_id" }),
    __metadata("design:type", UserSubscription_1.UserSubscription)
], SubscriptionInvoice.prototype, "subscription", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, (user) => user.id, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", User_1.User)
], SubscriptionInvoice.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => SubscriptionPlan_1.SubscriptionPlan, (plan) => plan.id),
    (0, typeorm_1.JoinColumn)({ name: "plan_id" }),
    __metadata("design:type", SubscriptionPlan_1.SubscriptionPlan)
], SubscriptionInvoice.prototype, "plan", void 0);
exports.SubscriptionInvoice = SubscriptionInvoice = __decorate([
    (0, typeorm_1.Entity)({ name: "subscription_invoices" })
], SubscriptionInvoice);
