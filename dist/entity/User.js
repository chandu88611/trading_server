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
exports.User = void 0;
// src/entity/User.ts
const typeorm_1 = require("typeorm");
const AuthProvider_1 = require("./AuthProvider");
const UserEdgingStatus_1 = require("./UserEdgingStatus");
let User = class User {
};
exports.User = User;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], User.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "citext", unique: true }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "referral_code", type: "text", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "referralCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "referred_by_user_id", type: "int", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "referredByUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "password_hash", type: "text", nullable: false }),
    __metadata("design:type", String)
], User.prototype, "passwordHash", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "is_email_verified",
        type: "boolean",
        default: false,
    }),
    __metadata("design:type", Boolean)
], User.prototype, "isEmailVerified", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "allow_trade",
        type: "boolean",
        default: true,
    }),
    __metadata("design:type", Boolean)
], User.prototype, "allowTrade", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "allow_copy_trade",
        type: "boolean",
        default: true,
    }),
    __metadata("design:type", Boolean)
], User.prototype, "allowCopyTrade", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "is_active",
        type: "boolean",
        default: true,
    }),
    __metadata("design:type", Boolean)
], User.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "is_admin",
        type: "boolean",
        default: false,
    }),
    __metadata("design:type", Boolean)
], User.prototype, "isAdmin", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "verification_token", type: "text", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "verificationToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "reset_token", type: "text", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "resetToken", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "reset_token_expires_at",
        type: "timestamptz",
        nullable: true,
    }),
    __metadata("design:type", Object)
], User.prototype, "resetTokenExpiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "failed_login_attempts",
        type: "int",
        default: 0,
    }),
    __metadata("design:type", Number)
], User.prototype, "failedLoginAttempts", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "locked_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "lockedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "mfa_enabled", type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "mfaEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "mfa_method", type: "varchar", length: 20, nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "mfaMethod", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "mfa_secret", type: "text", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "mfaSecret", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "recovery_codes", type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "recoveryCodes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], User.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], User.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "last_login_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "lastLoginAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "last_login_ip", type: "inet", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "lastLoginIp", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "last_login_user_agent",
        type: "text",
        nullable: true,
    }),
    __metadata("design:type", Object)
], User.prototype, "lastLoginUserAgent", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "deleted_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => AuthProvider_1.AuthProvider, (ap) => ap.user),
    __metadata("design:type", Array)
], User.prototype, "authProviders", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => UserEdgingStatus_1.UserEdgingStatus, (ues) => ues.user),
    __metadata("design:type", UserEdgingStatus_1.UserEdgingStatus)
], User.prototype, "userEdgingStatus", void 0);
exports.User = User = __decorate([
    (0, typeorm_1.Entity)({ name: "users" })
], User);
