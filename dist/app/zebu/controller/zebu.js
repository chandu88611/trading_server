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
exports.ZebuController = void 0;
const error_handler_1 = require("../../../types/error-handler");
const constants_1 = require("../../../types/constants");
const zebu_service_1 = require("../services/zebu.service");
class ZebuController {
    constructor() {
        this.service = new zebu_service_1.ZebuService();
    }
    requireUserId(req) {
        const userId = Number(req?.auth?.userId ?? req.body?.userId ?? req.query?.userId);
        if (!Number.isFinite(userId) || userId <= 0) {
            throw { statusCode: constants_1.HttpStatusCode._UNAUTHORISED, message: "userId_required" };
        }
        return userId;
    }
    requireTradingAccountId(req) {
        const id = Number(req.body?.tradingAccountId ?? req.query?.tradingAccountId);
        if (!Number.isFinite(id) || id <= 0) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "tradingAccountId_required" };
        }
        return id;
    }
    async saveToken(req, res) {
        const userId = this.requireUserId(req);
        const tradingAccountId = this.requireTradingAccountId(req);
        const accessToken = String(req.body?.accessToken ?? "").trim();
        const apiKey = String(req.body?.apiKey ?? "").trim() || undefined;
        if (!accessToken) {
            return res.status(constants_1.HttpStatusCode._BAD_REQUEST).json({ message: "accessToken_required" });
        }
        let baseUrl = process.env.ZEBU_BASE_URL ?? "";
        if (baseUrl === "") {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "zebu_base_url_not_configured" };
        }
        const result = await this.service.saveAuthToken({
            userId,
            tradingAccountId,
            accessToken,
            baseUrl,
            apiKey,
        });
        return res.json({ message: "zebu_token_saved", data: result });
    }
    async placeOrder(req, res) {
        const userId = this.requireUserId(req);
        const tradingAccountId = this.requireTradingAccountId(req);
        const order = req.body?.order;
        if (!order || !order.symbol || !order.side || !order.quantity) {
            return res.status(constants_1.HttpStatusCode._BAD_REQUEST).json({ message: "invalid_order_payload" });
        }
        const result = await this.service.placeOrder({
            userId,
            tradingAccountId,
            order,
        });
        return res.json({ message: "order_placed", data: result });
    }
    async modifyOrder(req, res) {
        const userId = this.requireUserId(req);
        const tradingAccountId = this.requireTradingAccountId(req);
        const orderId = String(req.body?.orderId ?? "").trim();
        if (!orderId) {
            return res.status(constants_1.HttpStatusCode._BAD_REQUEST).json({ message: "orderId_required" });
        }
        const result = await this.service.modifyOrder({
            userId,
            tradingAccountId,
            orderId,
            quantity: req.body?.quantity,
            price: req.body?.price,
            triggerPrice: req.body?.triggerPrice,
            validity: req.body?.validity,
        });
        return res.json({ message: "order_modified", data: result });
    }
    async cancelOrder(req, res) {
        const userId = this.requireUserId(req);
        const tradingAccountId = this.requireTradingAccountId(req);
        const orderId = String(req.body?.orderId ?? "").trim();
        if (!orderId) {
            return res.status(constants_1.HttpStatusCode._BAD_REQUEST).json({ message: "orderId_required" });
        }
        const result = await this.service.cancelOrder({ userId, tradingAccountId, orderId });
        return res.json({ message: "order_cancelled", data: result });
    }
    async getOrders(req, res) {
        const userId = this.requireUserId(req);
        const tradingAccountId = this.requireTradingAccountId(req);
        const data = await this.service.getOrders(userId, tradingAccountId);
        return res.json({ message: "orders", data });
    }
    async getPositions(req, res) {
        const userId = this.requireUserId(req);
        const tradingAccountId = this.requireTradingAccountId(req);
        const data = await this.service.getPositions(userId, tradingAccountId);
        return res.json({ message: "positions", data });
    }
    async getHoldings(req, res) {
        const userId = this.requireUserId(req);
        const tradingAccountId = this.requireTradingAccountId(req);
        const data = await this.service.getHoldings(userId, tradingAccountId);
        return res.json({ message: "holdings", data });
    }
    async executePending(req, res) {
        const batchSize = Number(req.body?.batchSize ?? undefined);
        const data = await this.service.executePendingBatch({
            batchSize: Number.isFinite(batchSize) ? batchSize : undefined,
        });
        return res.json({ message: "executed", data });
    }
}
exports.ZebuController = ZebuController;
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ZebuController.prototype, "saveToken", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ZebuController.prototype, "placeOrder", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ZebuController.prototype, "modifyOrder", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ZebuController.prototype, "cancelOrder", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ZebuController.prototype, "getOrders", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ZebuController.prototype, "getPositions", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ZebuController.prototype, "getHoldings", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ZebuController.prototype, "executePending", null);
