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
exports.UserBillingDetails = void 0;
const typeorm_1 = require("typeorm");
let UserBillingDetails = class UserBillingDetails {
};
exports.UserBillingDetails = UserBillingDetails;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("increment", { type: "bigint" }),
    __metadata("design:type", String)
], UserBillingDetails.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)({ unique: true }),
    (0, typeorm_1.Column)({ name: "user_id", type: "bigint" }),
    __metadata("design:type", String)
], UserBillingDetails.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "pan_number", type: "varchar", length: 10, nullable: true }),
    __metadata("design:type", Object)
], UserBillingDetails.prototype, "panNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "account_holder_name", type: "varchar", length: 120, nullable: true }),
    __metadata("design:type", Object)
], UserBillingDetails.prototype, "accountHolderName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "account_number", type: "varchar", length: 34, nullable: true }),
    __metadata("design:type", Object)
], UserBillingDetails.prototype, "accountNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "ifsc_code", type: "varchar", length: 11, nullable: true }),
    __metadata("design:type", Object)
], UserBillingDetails.prototype, "ifscCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "bank_name", type: "varchar", length: 120, nullable: true }),
    __metadata("design:type", Object)
], UserBillingDetails.prototype, "bankName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "branch", type: "varchar", length: 120, nullable: true }),
    __metadata("design:type", Object)
], UserBillingDetails.prototype, "branch", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "address_line1", type: "varchar", length: 255, nullable: true }),
    __metadata("design:type", Object)
], UserBillingDetails.prototype, "addressLine1", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "address_line2", type: "varchar", length: 255, nullable: true }),
    __metadata("design:type", Object)
], UserBillingDetails.prototype, "addressLine2", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "city", type: "varchar", length: 80, nullable: true }),
    __metadata("design:type", Object)
], UserBillingDetails.prototype, "city", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "state", type: "varchar", length: 80, nullable: true }),
    __metadata("design:type", Object)
], UserBillingDetails.prototype, "state", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "pincode", type: "varchar", length: 10, nullable: true }),
    __metadata("design:type", Object)
], UserBillingDetails.prototype, "pincode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "razorpay_contact_id", type: "text", nullable: true }),
    __metadata("design:type", Object)
], UserBillingDetails.prototype, "razorpayContactId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "razorpay_fund_account_id", type: "text", nullable: true }),
    __metadata("design:type", Object)
], UserBillingDetails.prototype, "razorpayFundAccountId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], UserBillingDetails.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], UserBillingDetails.prototype, "updatedAt", void 0);
exports.UserBillingDetails = UserBillingDetails = __decorate([
    (0, typeorm_1.Entity)({ name: "user_billing_details" })
], UserBillingDetails);
