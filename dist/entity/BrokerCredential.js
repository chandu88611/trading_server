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
exports.BrokerCredential = void 0;
const typeorm_1 = require("typeorm");
const User_1 = require("./User");
let BrokerCredential = class BrokerCredential {
};
exports.BrokerCredential = BrokerCredential;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], BrokerCredential.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, (u) => u.brokerCredentials, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", User_1.User)
], BrokerCredential.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "key_name", type: "text", nullable: true }),
    __metadata("design:type", Object)
], BrokerCredential.prototype, "keyName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "enc_api_key", type: "text", nullable: true }),
    __metadata("design:type", Object)
], BrokerCredential.prototype, "encApiKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "enc_api_secret", type: "text", nullable: true }),
    __metadata("design:type", Object)
], BrokerCredential.prototype, "encApiSecret", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "enc_request_token", type: "text", nullable: true }),
    __metadata("design:type", Object)
], BrokerCredential.prototype, "encRequestToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", default: "active" }),
    __metadata("design:type", String)
], BrokerCredential.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], BrokerCredential.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], BrokerCredential.prototype, "updatedAt", void 0);
exports.BrokerCredential = BrokerCredential = __decorate([
    (0, typeorm_1.Entity)({ name: "broker_credentials" }),
    (0, typeorm_1.Index)(["user", "keyName"], { unique: true })
], BrokerCredential);
