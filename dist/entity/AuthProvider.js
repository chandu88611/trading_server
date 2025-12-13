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
const typeorm_1 = require("typeorm");
const User_1 = require("./User");
let AuthProvider = class AuthProvider {
};
exports.AuthProvider = AuthProvider;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], AuthProvider.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, (u) => u.auth_providers, { onDelete: "CASCADE" }),
    __metadata("design:type", User_1.User)
], AuthProvider.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], AuthProvider.prototype, "provider", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], AuthProvider.prototype, "provider_user_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], AuthProvider.prototype, "provider_meta", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamptz" }),
    __metadata("design:type", Date)
], AuthProvider.prototype, "created_at", void 0);
exports.AuthProvider = AuthProvider = __decorate([
    (0, typeorm_1.Entity)({ name: "auth_providers" }),
    (0, typeorm_1.Index)(["provider", "provider_user_id"], { unique: true })
], AuthProvider);
