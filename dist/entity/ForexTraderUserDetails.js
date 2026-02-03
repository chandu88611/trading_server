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
exports.ForexTraderUserDetails = void 0;
const typeorm_1 = require("typeorm");
const User_1 = require("./User");
const entity_enum_1 = require("./entity.enum");
let ForexTraderUserDetails = class ForexTraderUserDetails {
};
exports.ForexTraderUserDetails = ForexTraderUserDetails;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("increment", { type: "bigint" }),
    __metadata("design:type", String)
], ForexTraderUserDetails.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "user_id", type: "bigint" }),
    __metadata("design:type", String)
], ForexTraderUserDetails.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "forex_trader_user_id", type: "varchar", length: 100 }),
    __metadata("design:type", String)
], ForexTraderUserDetails.prototype, "forexTraderUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: "forex_type",
        type: "enum",
        enum: entity_enum_1.ForexTradeCategory,
        enumName: "forex_trade_category",
    }),
    __metadata("design:type", String)
], ForexTraderUserDetails.prototype, "forexType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "token", type: "text", nullable: true }),
    __metadata("design:type", Object)
], ForexTraderUserDetails.prototype, "token", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "is_master", type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], ForexTraderUserDetails.prototype, "isMaster", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: "created_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], ForexTraderUserDetails.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: "updated_at", type: "timestamptz" }),
    __metadata("design:type", Date)
], ForexTraderUserDetails.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { nullable: true, onDelete: "SET NULL" }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", Object)
], ForexTraderUserDetails.prototype, "user", void 0);
exports.ForexTraderUserDetails = ForexTraderUserDetails = __decorate([
    (0, typeorm_1.Entity)({ name: "forex_trader_user_details" })
], ForexTraderUserDetails);
