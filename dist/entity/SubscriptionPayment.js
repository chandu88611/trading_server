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
exports.SubscriptionPayment = void 0;
const typeorm_1 = require("typeorm");
const SubscriptionInvoice_1 = require("./SubscriptionInvoice");
const User_1 = require("./User");
let SubscriptionPayment = class SubscriptionPayment {
};
exports.SubscriptionPayment = SubscriptionPayment;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], SubscriptionPayment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "invoice_id", type: "bigint", nullable: true }),
    __metadata("design:type", Object)
], SubscriptionPayment.prototype, "invoiceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "user_id", type: "bigint" }),
    __metadata("design:type", Number)
], SubscriptionPayment.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], SubscriptionPayment.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "amount_cents", type: "int" }),
    __metadata("design:type", Number)
], SubscriptionPayment.prototype, "amountCents", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 10, default: "INR" }),
    __metadata("design:type", String)
], SubscriptionPayment.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], SubscriptionPayment.prototype, "gateway", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "gateway_event_id",
        type: "text",
        unique: true,
        nullable: true,
    }),
    __metadata("design:type", Object)
], SubscriptionPayment.prototype, "gatewayEventId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "gateway_payload", type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], SubscriptionPayment.prototype, "gatewayPayload", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], SubscriptionPayment.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => SubscriptionInvoice_1.SubscriptionInvoice, (invoice) => invoice.id, {
        onDelete: "SET NULL",
    }),
    (0, typeorm_1.JoinColumn)({ name: "invoice_id" }),
    __metadata("design:type", Object)
], SubscriptionPayment.prototype, "invoice", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, (user) => user.id, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", User_1.User)
], SubscriptionPayment.prototype, "user", void 0);
exports.SubscriptionPayment = SubscriptionPayment = __decorate([
    (0, typeorm_1.Entity)({ name: "subscription_payments" })
], SubscriptionPayment);
