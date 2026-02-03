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
exports.UserController = void 0;
const error_handler_1 = require("../../../types/error-handler");
const user_service_1 = require("../services/user.service");
class UserController {
    constructor() {
        this.service = new user_service_1.UserService();
    }
    async registerUser(req, res) {
        const { provider, providerUserId, email, password, name } = req.body ?? {};
        if (provider) {
            if (!providerUserId || !email) {
                res.status(400).json({
                    message: "providerUserId and email are required for provider signup",
                });
                return;
            }
            const result = await this.service.registerWithProvider(provider, providerUserId, email, name);
            res.status(201).json({
                message: "User registered via provider",
                user: { id: result.user.id, email: result.user.email },
                tokens: {
                    access: result.accessToken,
                    refresh: result.refreshToken,
                },
            });
            return;
        }
        // Normal email/password registration
        if (!email || !password) {
            res
                .status(400)
                .json({ message: "email and password are required for signup" });
            return;
        }
        const result = await this.service.registerWithEmail(email, password, name);
        res.status(201).json({
            message: "User registered",
            user: { id: result.user.id, email: result.user.email },
            tokens: {
                access: result.accessToken,
                refresh: result.refreshToken,
            },
        });
    }
    async verifyEmail(req, res) {
        const { token } = req.query;
        if (!token) {
            res.status(400).json({ message: "Invalid token" });
            return;
        }
        await this.service.verifyEmail(token);
        res.status(200).json({
            message: "Email verified successfully",
        });
    }
    async getUserDetails(req, res) {
        const userId = req.auth.userId;
        const userData = await this.service.getUserDetails(Number(userId));
        res.status(200).json({ message: "ok", data: userData });
    }
    async getBillingDetails(req, res) {
        const userId = Number(req.auth.userId);
        const data = await this.service.getBillingDetails(userId);
        res.status(200).json({
            message: "Fetched billing details",
            data: data ?? null,
        });
    }
    async updateBillingDetails(req, res) {
        const userId = Number(req.auth.userId);
        const updated = await this.service.upsertBillingDetails(userId, req.body ?? {});
        res.status(200).json({
            message: "Billing details updated",
            data: updated,
        });
    }
    async updateTradeStatus(req, res) {
        const userId = Number(req.auth.userId);
        const { allowTrade } = req.body;
        if (typeof allowTrade !== "boolean") {
            res.status(400).json({ message: "allowTrade must be a boolean" });
            return;
        }
        const updatedUser = await this.service.updateTradeStatus(userId, allowTrade);
        res.status(200).json({
            message: "Trade status updated",
            data: { id: updatedUser.id, allowTrade: updatedUser.allowTrade },
        });
    }
    async updateCopyTradeStatus(req, res) {
        const userId = Number(req.auth.userId);
        const { allowCopyTrade } = req.body;
        if (typeof allowCopyTrade !== "boolean") {
            res.status(400).json({ message: "allowCopyTrade must be a boolean" });
            return;
        }
        const updatedUser = await this.service.updateCopyTradeStatus(userId, allowCopyTrade);
        res.status(200).json({
            message: "Copy trade status updated",
            data: { id: updatedUser.id, allowCopyTrade: updatedUser.allowCopyTrade },
        });
    }
}
exports.UserController = UserController;
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "registerUser", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "verifyEmail", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "getUserDetails", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "getBillingDetails", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "updateBillingDetails", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "updateTradeStatus", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "updateCopyTradeStatus", null);
