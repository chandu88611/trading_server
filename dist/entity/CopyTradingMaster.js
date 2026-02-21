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
const UserTradingAccount_1 = require("./UserTradingAccount");
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
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", String)
], CopyTradingMaster.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "user_trading_account_id", type: "bigint", nullable: true }),
    __metadata("design:type", Number)
], CopyTradingMaster.prototype, "userTradingAccountId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => UserTradingAccount_1.UserTradingAccount, { nullable: true, onDelete: "SET NULL" }),
    (0, typeorm_1.JoinColumn)({ name: "user_trading_account_id" }),
    __metadata("design:type", UserTradingAccount_1.UserTradingAccount)
], CopyTradingMaster.prototype, "userTradingAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "master_trading_account_id", type: "bigint", nullable: true }),
    __metadata("design:type", Number)
], CopyTradingMaster.prototype, "masterTradingAccountId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => UserTradingAccount_1.UserTradingAccount, { nullable: true, onDelete: "SET NULL" }),
    (0, typeorm_1.JoinColumn)({ name: "master_trading_account_id" }),
    __metadata("design:type", UserTradingAccount_1.UserTradingAccount)
], CopyTradingMaster.prototype, "masterTradingAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "is_active", type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], CopyTradingMaster.prototype, "isActive", void 0);
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
