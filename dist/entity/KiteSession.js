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
exports.KiteSession = void 0;
const typeorm_1 = require("typeorm");
const KiteCredential_1 = require("./KiteCredential");
let KiteSession = class KiteSession {
};
exports.KiteSession = KiteSession;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], KiteSession.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => KiteCredential_1.KiteCredential, { onDelete: "CASCADE" }),
    __metadata("design:type", KiteCredential_1.KiteCredential)
], KiteSession.prototype, "credential", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", String)
], KiteSession.prototype, "session_token", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", nullable: true }),
    __metadata("design:type", Date)
], KiteSession.prototype, "expires_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamptz", nullable: true }),
    __metadata("design:type", Date)
], KiteSession.prototype, "last_refreshed_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", default: "valid" }),
    __metadata("design:type", String)
], KiteSession.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamptz" }),
    __metadata("design:type", Date)
], KiteSession.prototype, "created_at", void 0);
exports.KiteSession = KiteSession = __decorate([
    (0, typeorm_1.Entity)({ name: "kite_sessions" })
], KiteSession);
