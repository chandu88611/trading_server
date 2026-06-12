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
exports.UserStrategyInstance = void 0;
const typeorm_1 = require("typeorm");
const User_1 = require("./User");
const Strategy_1 = require("./Strategy");
const SubscriptionPlan_1 = require("./SubscriptionPlan");
const UserSubscription_1 = require("./UserSubscription");
const UserTradingAccount_1 = require("./UserTradingAccount");
const subscriberPlan_enum_1 = require("../app/subscriptionPlan/enums/subscriberPlan.enum");
let UserStrategyInstance = class UserStrategyInstance {
};
exports.UserStrategyInstance = UserStrategyInstance;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], UserStrategyInstance.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "user_id", type: "bigint" }),
    __metadata("design:type", Number)
], UserStrategyInstance.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", User_1.User)
], UserStrategyInstance.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "subscription_id", type: "bigint" }),
    __metadata("design:type", Number)
], UserStrategyInstance.prototype, "subscriptionId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => UserSubscription_1.UserSubscription),
    (0, typeorm_1.JoinColumn)({ name: "subscription_id" }),
    __metadata("design:type", UserSubscription_1.UserSubscription)
], UserStrategyInstance.prototype, "subscription", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "plan_id", type: "bigint" }),
    __metadata("design:type", Number)
], UserStrategyInstance.prototype, "planId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => SubscriptionPlan_1.SubscriptionPlan),
    (0, typeorm_1.JoinColumn)({ name: "plan_id" }),
    __metadata("design:type", SubscriptionPlan_1.SubscriptionPlan)
], UserStrategyInstance.prototype, "plan", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "strategy_id", type: "bigint" }),
    __metadata("design:type", Number)
], UserStrategyInstance.prototype, "strategyId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Strategy_1.Strategy),
    (0, typeorm_1.JoinColumn)({ name: "strategy_id" }),
    __metadata("design:type", Strategy_1.Strategy)
], UserStrategyInstance.prototype, "strategy", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "trading_account_id", type: "bigint", nullable: true }),
    __metadata("design:type", Object)
], UserStrategyInstance.prototype, "tradingAccountId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => UserTradingAccount_1.UserTradingAccount, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: "trading_account_id" }),
    __metadata("design:type", Object)
], UserStrategyInstance.prototype, "tradingAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: subscriberPlan_enum_1.UserStrategyStatus,
        default: subscriberPlan_enum_1.UserStrategyStatus.ACTIVE,
    }),
    __metadata("design:type", String)
], UserStrategyInstance.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "strategy_version", type: "int" }),
    __metadata("design:type", Number)
], UserStrategyInstance.prototype, "strategyVersion", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", name: "frozen_params" }),
    __metadata("design:type", Object)
], UserStrategyInstance.prototype, "frozenParams", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 4, scale: 2, default: () => "0.01" }),
    __metadata("design:type", String)
], UserStrategyInstance.prototype, "volume", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "activated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], UserStrategyInstance.prototype, "activatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "paused_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], UserStrategyInstance.prototype, "pausedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "stopped_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], UserStrategyInstance.prototype, "stoppedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], UserStrategyInstance.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], UserStrategyInstance.prototype, "updatedAt", void 0);
exports.UserStrategyInstance = UserStrategyInstance = __decorate([
    (0, typeorm_1.Entity)({ name: "user_strategy_instances" }),
    (0, typeorm_1.Index)(["subscriptionId", "strategyId"], { unique: true })
], UserStrategyInstance);
