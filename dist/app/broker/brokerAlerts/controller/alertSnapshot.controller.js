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
exports.AlertSnapshotController = void 0;
const alertSnapshot_service_1 = require("../services/alertSnapshot.service");
const error_handler_1 = require("../../../../types/error-handler");
class AlertSnapshotController {
    constructor() {
        this.service = new alertSnapshot_service_1.AlertSnapshotService();
    }
    logIncomingAlert(scope, context) {
        console.log(`[ALERT] received ${scope} alert`, context);
    }
    async create(req, res) {
        const payload = req.body;
        const userId = req.auth.userId;
        const fullPayload = {
            ...payload,
            userId: Number(userId),
            subscriptionId: req.auth?.subscriptionId
                ? Number(req.auth.subscriptionId)
                : undefined,
            planId: req.auth?.planId,
            tokenType: req.auth?.tokenType,
        };
        this.logIncomingAlert("subscriber", {
            userId: Number(userId),
            subscriptionId: fullPayload.subscriptionId ?? null,
            planId: fullPayload.planId ?? null,
            tokenType: fullPayload.tokenType ?? null,
            market: payload?.market ?? null,
            ticker: payload?.ticker ?? null,
            action: payload?.action ?? null,
            executionMode: payload?.executionMode ?? null,
            entryRef: payload?.entryRef ?? null,
            tradingStrength: payload?.tradingStrength ?? null,
        });
        const s = await this.service.create(fullPayload);
        res.status(201).json({ message: "created", data: s });
    }
    async createStrategy(req, res) {
        const payload = req.body;
        const planId = Number(req.planWebhookAuth.planId);
        this.logIncomingAlert("admin_strategy", {
            planId,
            market: payload?.market ?? null,
            ticker: payload?.ticker ?? null,
            action: payload?.action ?? null,
            executionMode: payload?.executionMode ?? null,
            entryRef: payload?.entryRef ?? null,
            tradingStrength: payload?.tradingStrength ?? null,
        });
        const data = await this.service.createForPlan(planId, payload);
        res.status(201).json({ message: "created", data });
    }
    async getAdminHistory(req, res) {
        const data = await this.service.getAdminAlertHistory({
            page: Number(req.query.page ?? 1),
            limit: Number(req.query.limit ?? 20),
            userId: req.query.userId ? Number(req.query.userId) : undefined,
            planId: req.query.planId ? Number(req.query.planId) : undefined,
            ticker: req.query.ticker || undefined,
            exchange: req.query.exchange || undefined,
            interval: req.query.interval || undefined,
            from: req.query.from || undefined,
            to: req.query.to || undefined,
            lastMinutes: req.query.lastMinutes ? Number(req.query.lastMinutes) : undefined,
        });
        res.status(200).json({ message: "ok", data });
    }
    async getHistory(req, res) {
        const userId = Number(req.auth.userId);
        const data = await this.service.getAlertHistory(userId, {
            page: Number(req.query.page ?? 1),
            limit: Number(req.query.limit ?? 20),
            ticker: req.query.ticker || undefined,
            exchange: req.query.exchange || undefined,
            interval: req.query.interval || undefined,
            from: req.query.from || undefined,
            to: req.query.to || undefined,
            lastMinutes: req.query.lastMinutes
                ? Number(req.query.lastMinutes)
                : undefined,
        });
        res.status(200).json({ message: "ok", data });
    }
}
exports.AlertSnapshotController = AlertSnapshotController;
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AlertSnapshotController.prototype, "create", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AlertSnapshotController.prototype, "createStrategy", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AlertSnapshotController.prototype, "getAdminHistory", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AlertSnapshotController.prototype, "getHistory", null);
