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
exports.RazorpayOrder = void 0;
const typeorm_1 = require("typeorm");
let RazorpayOrder = class RazorpayOrder {
};
exports.RazorpayOrder = RazorpayOrder;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: "bigint" }),
    __metadata("design:type", String)
], RazorpayOrder.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "invoice_id", type: "bigint" }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], RazorpayOrder.prototype, "invoiceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "user_id", type: "bigint" }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], RazorpayOrder.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "razorpay_order_id", type: "text", unique: true }),
    __metadata("design:type", String)
], RazorpayOrder.prototype, "razorpayOrderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], RazorpayOrder.prototype, "receipt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "amount_cents", type: "int" }),
    __metadata("design:type", Number)
], RazorpayOrder.prototype, "amountCents", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 10, default: "INR" }),
    __metadata("design:type", String)
], RazorpayOrder.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", default: "created" }),
    __metadata("design:type", String)
], RazorpayOrder.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", default: () => "'{}'::jsonb" }),
    __metadata("design:type", Object)
], RazorpayOrder.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], RazorpayOrder.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], RazorpayOrder.prototype, "updatedAt", void 0);
exports.RazorpayOrder = RazorpayOrder = __decorate([
    (0, typeorm_1.Entity)({ name: "razorpay_orders" })
], RazorpayOrder);
