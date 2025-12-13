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
exports.KiteCredential = void 0;
const typeorm_1 = require("typeorm");
const User_1 = require("./User");
let KiteCredential = class KiteCredential {
};
exports.KiteCredential = KiteCredential;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], KiteCredential.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, (u) => u.kite_credentials, { onDelete: "CASCADE" }),
    __metadata("design:type", User_1.User)
], KiteCredential.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", String)
], KiteCredential.prototype, "key_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", String)
], KiteCredential.prototype, "enc_api_key", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", String)
], KiteCredential.prototype, "enc_api_secret", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", String)
], KiteCredential.prototype, "enc_request_token", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", default: "active" }),
    __metadata("design:type", String)
], KiteCredential.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamptz" }),
    __metadata("design:type", Date)
], KiteCredential.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamptz" }),
    __metadata("design:type", Date)
], KiteCredential.prototype, "updated_at", void 0);
exports.KiteCredential = KiteCredential = __decorate([
    (0, typeorm_1.Entity)({ name: "kite_credentials" }),
    (0, typeorm_1.Index)(["user", "key_name"], { unique: true })
], KiteCredential);
