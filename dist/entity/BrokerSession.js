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
exports.BrokerSession = void 0;
const typeorm_1 = require("typeorm");
const BrokerCredential_1 = require("./BrokerCredential");
let BrokerSession = class BrokerSession {
};
exports.BrokerSession = BrokerSession;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], BrokerSession.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => BrokerCredential_1.BrokerCredential, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "credential_id" }),
    __metadata("design:type", BrokerCredential_1.BrokerCredential)
], BrokerSession.prototype, "credential", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "session_token", type: "text", nullable: true }),
    __metadata("design:type", Object)
], BrokerSession.prototype, "sessionToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "expires_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], BrokerSession.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "last_refreshed_at", type: "timestamptz", nullable: true }),
    __metadata("design:type", Object)
], BrokerSession.prototype, "lastRefreshedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", default: "valid" }),
    __metadata("design:type", String)
], BrokerSession.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], BrokerSession.prototype, "createdAt", void 0);
exports.BrokerSession = BrokerSession = __decorate([
    (0, typeorm_1.Entity)({ name: "broker_sessions" })
], BrokerSession);
