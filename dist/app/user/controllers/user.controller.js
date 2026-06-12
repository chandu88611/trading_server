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
const auth_1 = require("../../../middleware/auth");
const constants_1 = require("../../../types/constants");
const crmLifecycleSync_service_1 = require("../../integrations/crm/services/crmLifecycleSync.service");
class UserController {
    constructor() {
        this.service = new user_service_1.UserService();
        this.crmLifecycleSyncService = new crmLifecycleSync_service_1.CrmLifecycleSyncService();
    }
    ensureAdmin(req) {
        const roles = req.auth?.roles ?? [];
        if (!roles.includes(auth_1.Roles.ADMIN)) {
            throw {
                statusCode: constants_1.HttpStatusCode._UNAUTHORISED,
                message: "Admin access required",
            };
        }
    }
    serializeBillingDetails(data) {
        if (!data)
            return null;
        const safeData = { ...data };
        delete safeData.razorpayContactId;
        delete safeData.razorpayFundAccountId;
        return safeData;
    }
    async registerUser(req, res) {
        const { provider, providerUserId, email, password, name, isAdmin, referralCode } = req.body ?? {};
        if (provider) {
            if (!providerUserId || !email) {
                res.status(400).json({
                    message: "providerUserId and email are required for provider signup",
                });
                return;
            }
            const result = await this.service.registerWithProvider(provider, providerUserId, email, name, isAdmin === true, referralCode);
            if (result.isNewUser) {
                void this.crmLifecycleSyncService.syncUserRegistered(result.user.id);
            }
            res.status(201).json({
                message: "User registered via provider",
                user: {
                    id: result.user.id,
                    email: result.user.email,
                    isAdmin: result.user.isAdmin,
                },
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
        const result = await this.service.registerWithEmail(email, password, name, isAdmin === true, referralCode);
        void this.crmLifecycleSyncService.syncUserRegistered(result.user.id);
        res.status(201).json({
            message: "User registered",
            user: {
                id: result.user.id,
                email: result.user.email,
                isAdmin: result.user.isAdmin,
            },
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
    async listUsers(req, res) {
        this.ensureAdmin(req);
        const rawPage = Number(req.query.page ?? 1);
        const rawLimit = Number(req.query.limit ?? 10);
        const search = String(req.query.search ?? "").trim();
        const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
        const limit = Number.isFinite(rawLimit)
            ? Math.min(100, Math.max(1, Math.floor(rawLimit)))
            : 10;
        const result = await this.service.listUsers({ page, limit, search });
        res.status(200).json({
            message: "Users fetched successfully",
            data: result.items,
            pagination: {
                page: result.page,
                limit: result.limit,
                totalItems: result.total,
                totalPages: result.totalPages,
            },
        });
    }
    async getReferral(req, res) {
        const userId = Number(req.auth.userId);
        const data = await this.service.getReferralSummary(userId, false);
        res.status(200).json({
            message: "Referral summary fetched successfully",
            data,
        });
    }
    async getUserReferral(req, res) {
        this.ensureAdmin(req);
        const userId = Number(req.params.userId);
        const data = await this.service.getReferralSummary(userId, true);
        res.status(200).json({
            message: "Referral summary fetched successfully",
            data,
        });
    }
    async updateAdminStatus(req, res) {
        this.ensureAdmin(req);
        const userId = Number(req.params.userId);
        const { isAdmin } = req.body ?? {};
        if (typeof isAdmin !== "boolean") {
            res.status(400).json({ message: "isAdmin must be a boolean" });
            return;
        }
        const updatedUser = await this.service.updateAdminStatus(userId, isAdmin);
        res.status(200).json({
            message: "Admin status updated",
            data: {
                id: updatedUser.id,
                email: updatedUser.email,
                isAdmin: updatedUser.isAdmin,
            },
        });
    }
    async getUserDetails(req, res) {
        const userId = req.auth.userId;
        const userData = await this.service.getUserDetails(Number(userId));
        res.status(200).json({ message: "ok", data: userData });
    }
    async getDashboard(req, res) {
        const userId = Number(req.auth.userId);
        const dashboardData = await this.service.getDashboardData(userId);
        res.status(200).json({
            message: "Dashboard fetched successfully",
            data: dashboardData,
        });
    }
    async getSettings(req, res) {
        const userId = Number(req.auth.userId);
        const settingsData = await this.service.getSettingsData(userId);
        res.status(200).json({
            message: "Settings fetched successfully",
            data: settingsData,
        });
    }
    async getAdminStrategyTradeSchedule(req, res) {
        this.ensureAdmin(req);
        const data = await this.service.getAdminStrategyTradeSchedule();
        res.status(200).json({
            message: "Admin strategy trade schedule fetched",
            data,
        });
    }
    async updateAdminStrategyTradeSchedule(req, res) {
        this.ensureAdmin(req);
        const data = await this.service.upsertAdminStrategyTradeSchedule(req.body ?? {});
        res.status(200).json({
            message: "Admin strategy trade schedule updated",
            data,
        });
    }
    async getBillingDetails(req, res) {
        const userId = Number(req.auth.userId);
        const data = await this.service.getBillingDetails(userId);
        res.status(200).json({
            message: "Fetched billing details",
            data: this.serializeBillingDetails(data),
        });
    }
    async updateBillingDetails(req, res) {
        const userId = Number(req.auth.userId);
        const updated = await this.service.upsertBillingDetails(userId, req.body ?? {});
        res.status(200).json({
            message: "Billing details updated",
            data: this.serializeBillingDetails(updated),
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
    async getEdgingStatus(req, res) {
        const userId = Number(req.auth.userId);
        const status = await this.service.getEdgingStatus(userId);
        res.status(200).json({
            message: "Edging status fetched",
            data: {
                userId: Number(status.userId),
                isEnabled: status.isEnabled,
                notes: status.notes ?? null,
                updatedAt: status.updatedAt,
            },
        });
    }
    async updateEdgingStatus(req, res) {
        const userId = Number(req.auth.userId);
        const { isEnabled, notes } = req.body ?? {};
        if (typeof isEnabled !== "boolean") {
            res.status(400).json({ message: "isEnabled must be a boolean" });
            return;
        }
        if (notes !== undefined && notes !== null && typeof notes !== "string") {
            res.status(400).json({ message: "notes must be a string" });
            return;
        }
        const status = await this.service.upsertEdgingStatus(userId, isEnabled, notes);
        res.status(200).json({
            message: "Edging status updated",
            data: {
                userId: Number(status.userId),
                isEnabled: status.isEnabled,
                notes: status.notes ?? null,
                updatedAt: status.updatedAt,
            },
        });
    }
    async updateRiskLimits(req, res) {
        const userId = Number(req.auth.userId);
        const { isEnabled, dailyLossLimit, dailyProfitTarget, maxTradesPerDay, cooldownAfterLossMins, } = req.body ?? {};
        if (typeof isEnabled !== "boolean") {
            res.status(400).json({ message: "isEnabled must be a boolean" });
            return;
        }
        const isNullableNonNegativeNumber = (value) => value === null ||
            (typeof value === "number" && Number.isFinite(value) && value >= 0);
        const isNullableNonNegativeInteger = (value) => value === null ||
            (typeof value === "number" &&
                Number.isInteger(value) &&
                Number.isFinite(value) &&
                value >= 0);
        if (dailyLossLimit !== undefined &&
            !isNullableNonNegativeNumber(dailyLossLimit)) {
            res.status(400).json({
                message: "dailyLossLimit must be null or a non-negative number",
            });
            return;
        }
        if (dailyProfitTarget !== undefined &&
            !isNullableNonNegativeNumber(dailyProfitTarget)) {
            res.status(400).json({
                message: "dailyProfitTarget must be null or a non-negative number",
            });
            return;
        }
        if (maxTradesPerDay !== undefined &&
            !isNullableNonNegativeInteger(maxTradesPerDay)) {
            res.status(400).json({
                message: "maxTradesPerDay must be null or a non-negative integer",
            });
            return;
        }
        if (cooldownAfterLossMins !== undefined &&
            !isNullableNonNegativeInteger(cooldownAfterLossMins)) {
            res.status(400).json({
                message: "cooldownAfterLossMins must be null or a non-negative integer",
            });
            return;
        }
        const riskLimits = await this.service.upsertRiskLimits(userId, {
            isEnabled,
            dailyLossLimit,
            dailyProfitTarget,
            maxTradesPerDay,
            cooldownAfterLossMins,
        });
        res.status(200).json({
            message: "Risk limits updated",
            data: riskLimits,
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
], UserController.prototype, "listUsers", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "getReferral", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "getUserReferral", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "updateAdminStatus", null);
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
], UserController.prototype, "getDashboard", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "getSettings", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "getAdminStrategyTradeSchedule", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "updateAdminStrategyTradeSchedule", null);
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
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "getEdgingStatus", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "updateEdgingStatus", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "updateRiskLimits", null);
