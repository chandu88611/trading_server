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
    (0, typeorm_1.ManyToOne)(() => User_1.User),
    __metadata("design:type", User_1.User)
], UserStrategyInstance.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => UserSubscription_1.UserSubscription),
    __metadata("design:type", UserSubscription_1.UserSubscription)
], UserStrategyInstance.prototype, "subscription", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => SubscriptionPlan_1.SubscriptionPlan),
    __metadata("design:type", SubscriptionPlan_1.SubscriptionPlan)
], UserStrategyInstance.prototype, "plan", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Strategy_1.Strategy),
    __metadata("design:type", Strategy_1.Strategy)
], UserStrategyInstance.prototype, "strategy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => UserTradingAccount_1.UserTradingAccount, { nullable: true }),
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
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], UserStrategyInstance.prototype, "strategyVersion", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb" }),
    __metadata("design:type", Object)
], UserStrategyInstance.prototype, "frozenParams", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], UserStrategyInstance.prototype, "activatedAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], UserStrategyInstance.prototype, "updatedAt", void 0);
exports.UserStrategyInstance = UserStrategyInstance = __decorate([
    (0, typeorm_1.Entity)({ name: "user_strategy_instances" })
], UserStrategyInstance);
