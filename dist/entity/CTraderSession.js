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
exports.CTraderSession = void 0;
const typeorm_1 = require("typeorm");
let CTraderSession = class CTraderSession {
};
exports.CTraderSession = CTraderSession;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], CTraderSession.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "user_id", type: "varchar", length: 255 }),
    __metadata("design:type", String)
], CTraderSession.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "env", type: "enum", enum: ["demo", "live"], default: "demo" }),
    __metadata("design:type", String)
], CTraderSession.prototype, "env", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "active_account_id", type: "integer", nullable: true }),
    __metadata("design:type", Object)
], CTraderSession.prototype, "activeAccountId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "access_token_enc", type: "text", nullable: true }),
    __metadata("design:type", Object)
], CTraderSession.prototype, "accessTokenEnc", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "refresh_token_enc", type: "text", nullable: true }),
    __metadata("design:type", Object)
], CTraderSession.prototype, "refreshTokenEnc", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at" }),
    __metadata("design:type", Date)
], CTraderSession.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at" }),
    __metadata("design:type", Date)
], CTraderSession.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "expires_at", type: "timestamp with time zone", nullable: true }),
    __metadata("design:type", Object)
], CTraderSession.prototype, "expiresAt", void 0);
exports.CTraderSession = CTraderSession = __decorate([
    (0, typeorm_1.Entity)({ name: "ctrader_sessions" }),
    (0, typeorm_1.Index)(["userId"], { unique: true })
], CTraderSession);
