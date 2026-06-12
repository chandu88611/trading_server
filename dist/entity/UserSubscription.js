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
exports.UserSubscription = void 0;
const typeorm_1 = require("typeorm");
const User_1 = require("./User");
const SubscriptionPlan_1 = require("./SubscriptionPlan");
const subscriberPlan_enum_1 = require("../app/subscriptionPlan/enums/subscriberPlan.enum");
const UserTradingAccount_1 = require("./UserTradingAccount");
const UserStrategyInstance_1 = require("./UserStrategyInstance");
let UserSubscription = class UserSubscription {
};
exports.UserSubscription = UserSubscription;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], UserSubscription.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "user_id", type: "bigint" }),
    __metadata("design:type", Number)
], UserSubscription.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "plan_id", type: "bigint" }),
    __metadata("design:type", Number)
], UserSubscription.prototype, "planId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", User_1.User)
], UserSubscription.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => SubscriptionPlan_1.SubscriptionPlan, { onDelete: "RESTRICT" }),
    (0, typeorm_1.JoinColumn)({ name: "plan_id" }),
    __metadata("design:type", SubscriptionPlan_1.SubscriptionPlan)
], UserSubscription.prototype, "plan", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "status", type: "text", nullable: true }),
    __metadata("design:type", Object)
], UserSubscription.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "status_v2",
        type: "enum",
        enum: subscriberPlan_enum_1.SubscriptionStatus,
        enumName: "subscription_status",
        nullable: true,
    }),
    __metadata("design:type", Object)
], UserSubscription.prototype, "statusV2", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "auto_renew", type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], UserSubscription.prototype, "autoRenew", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "webhook_token", type: "text", nullable: true }),
    __metadata("design:type", Object)
], UserSubscription.prototype, "webhookToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "execution_enabled", type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], UserSubscription.prototype, "executionEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "liquidate_only_until", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], UserSubscription.prototype, "liquidateOnlyUntil", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "start_date", type: "timestamptz", default: () => "now()" }),
    __metadata("design:type", Date)
], UserSubscription.prototype, "startDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "is_webhook_enabled", type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], UserSubscription.prototype, "isWebhookEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "end_date", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], UserSubscription.prototype, "endDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "cancel_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], UserSubscription.prototype, "cancelAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "canceled_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], UserSubscription.prototype, "canceledAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], UserSubscription.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => UserTradingAccount_1.UserTradingAccount, (a) => a.subscription),
    __metadata("design:type", Array)
], UserSubscription.prototype, "tradingAccounts", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => UserStrategyInstance_1.UserStrategyInstance, (instance) => instance.subscription),
    __metadata("design:type", Array)
], UserSubscription.prototype, "strategyInstances", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], UserSubscription.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], UserSubscription.prototype, "updatedAt", void 0);
exports.UserSubscription = UserSubscription = __decorate([
    (0, typeorm_1.Entity)({ name: "user_subscriptions" })
], UserSubscription);
