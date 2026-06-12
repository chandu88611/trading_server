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
exports.SubscriptionPlanController = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_1 = require("../../../middleware/auth");
const error_handler_1 = require("../../../types/error-handler");
const subscriptionPlan_1 = require("../services/subscriptionPlan");
const constants_1 = require("../../../types/constants");
function resolveOptionalUserId(req) {
    try {
        let token = null;
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
            token = authHeader.slice("Bearer ".length).trim();
        }
        if (!token) {
            token = req.cookies?.access_token || null;
        }
        if (!token)
            return null;
        const payload = jsonwebtoken_1.default.verify(token, (0, auth_1.getJwtSecret)());
        if (payload?.type !== "access")
            return null;
        const userId = Number(payload?.userId);
        return Number.isFinite(userId) && userId > 0 ? userId : null;
    }
    catch {
        return null;
    }
}
class SubscriptionPlanController {
    constructor() {
        this.service = new subscriptionPlan_1.SubscriptionPlanService();
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
    resolveWebhookOrigin(req) {
        const configuredBaseUrl = String(process.env.WEBHOOK_PUBLIC_BASE_URL ||
            process.env.PUBLIC_API_BASE_URL ||
            process.env.APP_BASE_URL ||
            "").trim();
        if (configuredBaseUrl) {
            try {
                return new URL(configuredBaseUrl).origin;
            }
            catch { }
        }
        const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "")
            .split(",")[0]
            .trim();
        const forwardedHost = String(req.headers["x-forwarded-host"] ?? "")
            .split(",")[0]
            .trim();
        const host = forwardedHost || String(req.headers.host ?? "").trim();
        const protocol = forwardedProto || req.protocol || "http";
        return host ? `${protocol}://${host}` : "";
    }
    buildStrategyWebhookUrl(req, token) {
        const origin = this.resolveWebhookOrigin(req);
        const path = `/tradingview/alerts/strategy?token=${encodeURIComponent(token)}`;
        return origin ? `${origin}${path}` : path;
    }
    async createPlan(req, res) {
        this.ensureAdmin(req);
        const payload = req.body;
        const plan = await this.service.createPlan(payload);
        res.status(201).json({ message: "Subscription plan created", data: plan });
    }
    async getPlan(req, res) {
        const id = Number(req.params.planId); // BIGINT
        const plan = await this.service.getPlan(id);
        res.status(200).json({ message: "Fetched", data: plan });
    }
    async updatePlan(req, res) {
        this.ensureAdmin(req);
        const id = Number(req.params.planId); // BIGINT
        const payload = req.body;
        await this.service.updatePlan(id, payload);
        res.status(200).json({ message: "Updated successfully" });
    }
    async deletePlan(req, res) {
        this.ensureAdmin(req);
        const id = Number(req.params.planId); // BIGINT
        await this.service.deactivatePlan(id);
        res.status(200).json({ message: "Plan deactivated" });
    }
    async getAll(req, res) {
        const query = req.query;
        const viewerUserId = resolveOptionalUserId(req);
        if (typeof query.isActive === "string") {
            query.isActive = query.isActive === "true";
        }
        const result = await this.service.getPlans(query, viewerUserId);
        res.status(200).json({
            message: "Fetched all plans",
            data: [result.rows, result.total],
            subscriberHasAnyActivePlan: result.subscriberHasAnyActivePlan,
            subscriberActivePlanIds: result.subscriberActivePlanIds,
        });
    }
    async getActive(req, res) {
        const query = req.query;
        const viewerUserId = resolveOptionalUserId(req);
        query.isActive = true;
        const result = await this.service.getPlans(query, viewerUserId);
        res.status(200).json({
            message: "Fetched active plans",
            data: [result.rows, result.total],
            subscriberHasAnyActivePlan: result.subscriberHasAnyActivePlan,
            subscriberActivePlanIds: result.subscriberActivePlanIds,
        });
    }
    async getAdminWebhookToken(req, res) {
        this.ensureAdmin(req);
        const planId = Number(req.params.planId);
        const token = await this.service.getAdminWebhookToken(planId);
        res.status(200).json({
            message: "Fetched admin webhook token",
            data: {
                planId,
                adminWebhookToken: token,
                url: this.buildStrategyWebhookUrl(req, token),
            },
        });
    }
    async rotateAdminWebhookToken(req, res) {
        this.ensureAdmin(req);
        const planId = Number(req.params.planId);
        const token = await this.service.rotateAdminWebhookToken(planId);
        res.status(200).json({
            message: "Rotated admin webhook token",
            data: {
                planId,
                adminWebhookToken: token,
                url: this.buildStrategyWebhookUrl(req, token),
            },
        });
    }
}
exports.SubscriptionPlanController = SubscriptionPlanController;
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionPlanController.prototype, "createPlan", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionPlanController.prototype, "getPlan", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionPlanController.prototype, "updatePlan", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionPlanController.prototype, "deletePlan", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionPlanController.prototype, "getAll", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionPlanController.prototype, "getActive", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionPlanController.prototype, "getAdminWebhookToken", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionPlanController.prototype, "rotateAdminWebhookToken", null);
