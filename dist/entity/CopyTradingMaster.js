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
exports.CopyTradingMaster = exports.CopyMasterVisibility = exports.CopyMasterSourceType = void 0;
const typeorm_1 = require("typeorm");
const User_1 = require("./User");
const UserTradingAccount_1 = require("./UserTradingAccount");
const Strategy_1 = require("./Strategy");
var CopyMasterSourceType;
(function (CopyMasterSourceType) {
    CopyMasterSourceType["TRADING_ACCOUNT"] = "TRADING_ACCOUNT";
    CopyMasterSourceType["STRATEGY"] = "STRATEGY";
})(CopyMasterSourceType || (exports.CopyMasterSourceType = CopyMasterSourceType = {}));
var CopyMasterVisibility;
(function (CopyMasterVisibility) {
    CopyMasterVisibility["PRIVATE"] = "private";
    CopyMasterVisibility["UNLISTED"] = "unlisted";
    CopyMasterVisibility["PUBLIC"] = "public";
})(CopyMasterVisibility || (exports.CopyMasterVisibility = CopyMasterVisibility = {}));
let CopyTradingMaster = class CopyTradingMaster {
};
exports.CopyTradingMaster = CopyTradingMaster;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("increment", { type: "bigint" }),
    __metadata("design:type", String)
], CopyTradingMaster.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "owner_user_id", type: "bigint", nullable: true }),
    __metadata("design:type", Object)
], CopyTradingMaster.prototype, "ownerUserId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { nullable: true, onDelete: "SET NULL" }),
    (0, typeorm_1.JoinColumn)({ name: "owner_user_id" }),
    __metadata("design:type", Object)
], CopyTradingMaster.prototype, "ownerUser", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "source_type",
        type: "enum",
        enum: CopyMasterSourceType,
        enumName: "copy_master_source_type",
        default: CopyMasterSourceType.TRADING_ACCOUNT,
    }),
    __metadata("design:type", String)
], CopyTradingMaster.prototype, "sourceType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "source_trading_account_id", type: "bigint", nullable: true }),
    __metadata("design:type", Object)
], CopyTradingMaster.prototype, "sourceTradingAccountId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => UserTradingAccount_1.UserTradingAccount, { nullable: true, onDelete: "SET NULL" }),
    (0, typeorm_1.JoinColumn)({ name: "source_trading_account_id" }),
    __metadata("design:type", Object)
], CopyTradingMaster.prototype, "sourceTradingAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "source_strategy_id", type: "bigint", nullable: true }),
    __metadata("design:type", Object)
], CopyTradingMaster.prototype, "sourceStrategyId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Strategy_1.Strategy, { nullable: true, onDelete: "SET NULL" }),
    (0, typeorm_1.JoinColumn)({ name: "source_strategy_id" }),
    __metadata("design:type", Object)
], CopyTradingMaster.prototype, "sourceStrategy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], CopyTradingMaster.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], CopyTradingMaster.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: CopyMasterVisibility,
        enumName: "copy_master_visibility",
        default: CopyMasterVisibility.PRIVATE,
    }),
    __metadata("design:type", String)
], CopyTradingMaster.prototype, "visibility", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "requires_approval", type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], CopyTradingMaster.prototype, "requiresApproval", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "is_active", type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], CopyTradingMaster.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", default: () => "'{}'::jsonb" }),
    __metadata("design:type", Object)
], CopyTradingMaster.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], CopyTradingMaster.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], CopyTradingMaster.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ name: "deleted_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], CopyTradingMaster.prototype, "deletedAt", void 0);
exports.CopyTradingMaster = CopyTradingMaster = __decorate([
    (0, typeorm_1.Entity)({ name: "copy_trading_masters" })
], CopyTradingMaster);
