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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSubscriptionController = void 0;
const error_handler_1 = require("../../../types/error-handler");
const userSubscription_1 = require("../services/userSubscription");
const crmLifecycleSync_service_1 = require("../../integrations/crm/services/crmLifecycleSync.service");
const auth_1 = require("../../../middleware/auth");
const constants_1 = require("../../../types/constants");
const data_source_1 = __importDefault(require("../../../db/data-source"));
const UserSubscription_1 = require("../../../entity/UserSubscription");
class UserSubscriptionController {
    constructor() {
        this.service = new userSubscription_1.UserSubscriptionService();
        this.crmSyncService = new crmLifecycleSync_service_1.CrmLifecycleSyncService();
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
    ensureNonAdmin(req) {
        const roles = req.auth?.roles ?? [];
        if (roles.includes(auth_1.Roles.ADMIN)) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "admin_subscriptions_not_allowed",
            };
        }
    }
    async subscribe(req, res) {
        this.ensureNonAdmin(req);
        const userId = Number(req.auth.userId);
        const payload = req.body;
        const subscription = await this.service.subscribe(userId, payload);
        void this.crmSyncService.dispatchSubscriptionEvent({
            eventType: "subscription.activated",
            userId,
            subscriptionId: Number(subscription.id),
        });
        res.status(201).json({
            message: "Subscription activated",
            data: subscription,
        });
    }
    async cancel(req, res) {
        this.ensureNonAdmin(req);
        const userId = Number(req.auth.userId);
        const payload = req.body;
        await this.service.cancel(userId, payload);
        void this.crmSyncService.dispatchSubscriptionEvent({
            eventType: "subscription.canceled",
            userId,
        });
        res.status(200).json({
            message: "Subscription has been canceled successfully",
        });
    }
    async current(req, res) {
        this.ensureNonAdmin(req);
        const userId = Number(req.auth.userId);
        const start = Number(req.query.start || 0);
        const count = Number(req.query.count || 20);
        let searchParams = req.query.searchParams;
        if (typeof searchParams === "string") {
            try {
                searchParams = JSON.parse(searchParams);
            }
            catch (_error) {
                searchParams = {};
            }
        }
        searchParams = {
            ...(searchParams && typeof searchParams === "object" ? searchParams : {}),
            ...(req.query.market ? { market: String(req.query.market) } : {}),
        };
        const subscription = await this.service.getCurrentSubscription(userId, start, count, searchParams);
        res.status(200).json({
            message: "Fetched current subscription",
            data: subscription,
            subscription,
        });
    }
    async followerUserTradingAccount(req, res) {
        this.ensureNonAdmin(req);
        const userId = Number(req.auth.userId);
        const start = Number(req.query.start || 0);
        const count = Number(req.query.count || 20);
        const searchParams = req.query.searchParams;
        const followers = await this.service.getFollowerUserTradingAccount(userId, start, count, searchParams);
        res.status(200).json({
            message: "Fetched follower user trading account",
            followers,
        });
    }
    async getUserSubscriptions(req, res) {
        this.ensureAdmin(req);
        const userId = Number(req.params.userId);
        const subs = await this.service.getUserSubscriptions(userId);
        res.status(200).json({
            message: "Fetched user subscription history",
            data: subs,
        });
    }
    async adminGetAll(req, res) {
        this.ensureAdmin(req);
        const offset = Number(req.query.offset || 0);
        const limit = Number(req.query.limit || 20);
        const data = await this.service.getAllSubscriptions(offset, limit);
        res.status(200).json({
            message: "Fetched all subscriptions",
            data,
        });
    }
    async updateWebhookStatus(req, res) {
        this.ensureAdmin(req);
        const { subscriptionId, isWebhookEnabled } = req.body;
        if (subscriptionId === undefined || isWebhookEnabled === undefined) {
            res.status(400).json({ message: "subscriptionId and isWebhookEnabled are required" });
            return;
        }
        await this.service.updateSubscriptionWebhookStatus(subscriptionId, isWebhookEnabled);
        res.status(200).json({
            message: "Subscription webhook status updated successfully",
        });
    }
    async saveWebhookSettings(req, res) {
        const userId = Number(req.auth.userId);
        const body = req.body ?? {};
        const data = await this.service.saveWebhookSettings(userId, {
            subscriptionId: body.subscriptionId === undefined || body.subscriptionId === null || body.subscriptionId === ""
                ? null
                : Number(body.subscriptionId),
            planId: body.planId === undefined || body.planId === null || body.planId === ""
                ? null
                : Number(body.planId),
            isWebhookEnabled: Boolean(body.isWebhookEnabled),
            defaultTradingAccountId: body.defaultTradingAccountId === undefined ||
                body.defaultTradingAccountId === null ||
                body.defaultTradingAccountId === ""
                ? null
                : Number(body.defaultTradingAccountId),
            payloadDefaults: body.payloadDefaults && typeof body.payloadDefaults === "object"
                ? body.payloadDefaults
                : {},
        });
        res.json({ message: "webhook_settings_saved", data });
    }
    async saveStrategySelections(req, res) {
        try {
            const userId = Number(req.auth.userId);
            const selections = req.body?.strategySelections;
            if (!selections || typeof selections !== "object") {
                res.status(400).json({ message: "strategySelections_required" });
                return;
            }
            const repo = data_source_1.default.getRepository(UserSubscription_1.UserSubscription);
            const sub = await repo.findOne({ where: { userId }, order: { updatedAt: "DESC" } });
            if (!sub) {
                res.status(404).json({ message: "subscription_not_found" });
                return;
            }
            sub.metadata = { ...(sub.metadata ?? {}), strategySelections: selections };
            await repo.save(sub);
            res.json({ data: sub });
        }
        catch (e) {
            res.status(500).json({ message: e?.message ?? "error" });
        }
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
], UserSubscriptionController.prototype, "followerUserTradingAccount", null);
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
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserSubscriptionController.prototype, "updateWebhookStatus", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserSubscriptionController.prototype, "saveWebhookSettings", null);
