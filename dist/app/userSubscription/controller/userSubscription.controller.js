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
exports.UserSubscriptionController = void 0;
const error_handler_1 = require("../../../types/error-handler");
const userSubscription_1 = require("../services/userSubscription");
class UserSubscriptionController {
    constructor() {
        this.service = new userSubscription_1.UserSubscriptionService();
    }
    async subscribe(req, res) {
        const userId = req.auth.id;
        const payload = req.body;
        const subscription = await this.service.subscribe(userId, payload);
        res.status(201).json({
            message: "Subscription activated",
            data: subscription,
        });
    }
    async cancel(req, res) {
        const userId = req.auth.id;
        const payload = req.body;
        await this.service.cancel(userId, payload);
        res.status(200).json({
            message: "Subscription has been canceled successfully",
        });
    }
    async current(req, res) {
        const userId = req.auth.id;
        const subscription = await this.service.getCurrentSubscription(userId);
        res.status(200).json({
            message: "Fetched current subscription",
            data: subscription,
        });
    }
    async getUserSubscriptions(req, res) {
        const userId = Number(req.params.userId);
        const subs = await this.service.getUserSubscriptions(userId);
        res.status(200).json({
            message: "Fetched user subscription history",
            data: subs,
        });
    }
    async adminGetAll(req, res) {
        const offset = Number(req.query.offset || 0);
        const limit = Number(req.query.limit || 20);
        const data = await this.service.getAllSubscriptions(offset, limit);
        res.status(200).json({
            message: "Fetched all subscriptions",
            data,
        });
    }
}
exports.UserSubscriptionController = UserSubscriptionController;
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserSubscriptionController.prototype, "subscribe", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserSubscriptionController.prototype, "cancel", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserSubscriptionController.prototype, "current", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserSubscriptionController.prototype, "getUserSubscriptions", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserSubscriptionController.prototype, "adminGetAll", null);
