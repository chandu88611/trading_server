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
exports.CopyTradingFollowers = exports.CopyRiskMode = exports.CopyFollowStatus = void 0;
const typeorm_1 = require("typeorm");
const User_1 = require("./User");
const UserTradingAccount_1 = require("./UserTradingAccount");
var CopyFollowStatus;
(function (CopyFollowStatus) {
    CopyFollowStatus["PENDING"] = "pending";
    CopyFollowStatus["ACTIVE"] = "active";
    CopyFollowStatus["PAUSED"] = "paused";
    CopyFollowStatus["STOPPED"] = "stopped";
    CopyFollowStatus["REJECTED"] = "rejected";
})(CopyFollowStatus || (exports.CopyFollowStatus = CopyFollowStatus = {}));
var CopyRiskMode;
(function (CopyRiskMode) {
    CopyRiskMode["MULTIPLIER"] = "multiplier";
    CopyRiskMode["FIXED_LOT"] = "fixed_lot";
    CopyRiskMode["FIXED_RISK_PCT"] = "fixed_risk_pct";
})(CopyRiskMode || (exports.CopyRiskMode = CopyRiskMode = {}));
let CopyTradingFollowers = class CopyTradingFollowers {
};
exports.CopyTradingFollowers = CopyTradingFollowers;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id" }),
    __metadata("design:type", Number)
], CopyTradingFollowers.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "master_id", type: "bigint" }),
    __metadata("design:type", Number)
], CopyTradingFollowers.prototype, "masterId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => UserTradingAccount_1.UserTradingAccount, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "master_id" }),
    __metadata("design:type", UserTradingAccount_1.UserTradingAccount)
], CopyTradingFollowers.prototype, "master", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "follower_user_id", type: "bigint" }),
    __metadata("design:type", Number)
], CopyTradingFollowers.prototype, "followerUserId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "follower_user_id" }),
    __metadata("design:type", User_1.User)
], CopyTradingFollowers.prototype, "followerUser", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: "follower_trading_account_id", type: "bigint" }),
    __metadata("design:type", Number)
], CopyTradingFollowers.prototype, "followerTradingAccountId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => UserTradingAccount_1.UserTradingAccount, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "follower_trading_account_id" }),
    __metadata("design:type", UserTradingAccount_1.UserTradingAccount)
], CopyTradingFollowers.prototype, "followerTradingAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "status",
        type: "enum",
        enum: CopyFollowStatus,
        default: CopyFollowStatus.ACTIVE,
    }),
    __metadata("design:type", String)
], CopyTradingFollowers.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "requested_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], CopyTradingFollowers.prototype, "requestedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "approved_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], CopyTradingFollowers.prototype, "approvedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "paused_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], CopyTradingFollowers.prototype, "pausedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "stopped_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], CopyTradingFollowers.prototype, "stoppedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], CopyTradingFollowers.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], CopyTradingFollowers.prototype, "updatedAt", void 0);
exports.CopyTradingFollowers = CopyTradingFollowers = __decorate([
    (0, typeorm_1.Entity)({ name: "copy_trading_followers" })
], CopyTradingFollowers);
