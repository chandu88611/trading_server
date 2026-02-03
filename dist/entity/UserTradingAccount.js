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
exports.UserTradingAccount = void 0;
// src/entity/UserTradingAccount.ts
const typeorm_1 = require("typeorm");
const User_1 = require("./User");
const UserSubscription_1 = require("./UserSubscription");
const subscriberPlan_enum_1 = require("../app/subscriptionPlan/enums/subscriberPlan.enum");
let UserTradingAccount = class UserTradingAccount {
};
exports.UserTradingAccount = UserTradingAccount;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id" }),
    __metadata("design:type", Number)
], UserTradingAccount.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "user_id", type: "bigint" }),
    __metadata("design:type", Number)
], UserTradingAccount.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", User_1.User)
], UserTradingAccount.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "subscription_id", type: "bigint", nullable: true }),
    __metadata("design:type", Object)
], UserTradingAccount.prototype, "subscriptionId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => UserSubscription_1.UserSubscription, { onDelete: "SET NULL", nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: "subscription_id" }),
    __metadata("design:type", Object)
], UserTradingAccount.prototype, "subscription", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "is_master", type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], UserTradingAccount.prototype, "isMaster", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "broker", type: "text" }),
    __metadata("design:type", String)
], UserTradingAccount.prototype, "broker", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "execution_flow",
        type: "enum",
        enum: subscriberPlan_enum_1.ExecutionFlow,
        // If your DB enum type name is `execution_flow`, you can add:
        // enumName: "execution_flow",
    }),
    __metadata("design:type", String)
], UserTradingAccount.prototype, "executionFlow", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "account_label", type: "text", nullable: true }),
    __metadata("design:type", Object)
], UserTradingAccount.prototype, "accountLabel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "account_meta", type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], UserTradingAccount.prototype, "accountMeta", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "credentials_encrypted", type: "text" }),
    __metadata("design:type", String)
], UserTradingAccount.prototype, "credentialsEncrypted", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "status",
        type: "enum",
        enum: subscriberPlan_enum_1.TradingAccountStatus,
        // If your DB enum type name is `trading_account_status`, you can add:
        // enumName: "trading_account_status",
        default: subscriberPlan_enum_1.TradingAccountStatus.PENDING,
    }),
    __metadata("design:type", String)
], UserTradingAccount.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "last_verified_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], UserTradingAccount.prototype, "lastVerifiedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], UserTradingAccount.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], UserTradingAccount.prototype, "updatedAt", void 0);
exports.UserTradingAccount = UserTradingAccount = __decorate([
    (0, typeorm_1.Entity)({ name: "user_trading_accounts" })
], UserTradingAccount);
