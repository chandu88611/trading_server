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
exports.Broker = void 0;
const typeorm_1 = require("typeorm");
let Broker = class Broker {
};
exports.Broker = Broker;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Broker.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", unique: true, name: "code" }),
    __metadata("design:type", String)
], Broker.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "name" }),
    __metadata("design:type", String)
], Broker.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", name: "market_category" }),
    __metadata("design:type", String)
], Broker.prototype, "marketCategory", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", name: "is_active", default: true }),
    __metadata("design:type", Boolean)
], Broker.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], Broker.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], Broker.prototype, "updatedAt", void 0);
exports.Broker = Broker = __decorate([
    (0, typeorm_1.Entity)({ name: "brokers" })
], Broker);
