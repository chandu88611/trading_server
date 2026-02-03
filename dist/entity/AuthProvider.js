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
exports.AuthProvider = void 0;
// src/entity/AuthProvider.ts
const typeorm_1 = require("typeorm");
const User_1 = require("./User");
let AuthProvider = class AuthProvider {
};
exports.AuthProvider = AuthProvider;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], AuthProvider.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int", name: "user_id" }),
    __metadata("design:type", Number)
], AuthProvider.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, (u) => u.authProviders, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", User_1.User)
], AuthProvider.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], AuthProvider.prototype, "provider", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "provider_user_id", type: "text" }),
    __metadata("design:type", String)
], AuthProvider.prototype, "providerUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "provider_meta", type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], AuthProvider.prototype, "providerMeta", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], AuthProvider.prototype, "createdAt", void 0);
exports.AuthProvider = AuthProvider = __decorate([
    (0, typeorm_1.Index)(["provider", "providerUserId"], { unique: true }),
    (0, typeorm_1.Entity)({ name: "auth_providers" })
], AuthProvider);
