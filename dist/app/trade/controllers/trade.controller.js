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
exports.TradeController = void 0;
const error_handler_1 = require("../../../types/error-handler");
const trade_service_1 = require("../services/trade.service");
class TradeController {
    constructor() {
        this.service = new trade_service_1.TradeService();
    }
    async getAllTrades(req, res) {
        const userId = Number(req.auth.userId);
        const { start = 0, count = 10, searchParams, accountId, status } = req.query ?? {};
        if (accountId == null || accountId === "" || accountId === undefined) {
            res.status(400).json({ message: "missing_account_id" });
            return;
        }
        const result = await this.service.getAllTradesForUser({ userId, accountId: String(accountId), start: Number(start), count: Number(count), searchParams: searchParams, status: status });
        res.status(200).json(result);
    }
    async getSingleTrade(req, res) {
        let signalId = req.query.signalId;
        if (signalId == null || signalId === "" || signalId === undefined) {
            res.status(400).json({ message: "missing_signal_id" });
            return;
        }
        const result = await this.service.getSignalStatusForTrade(Number(signalId));
        res.status(200).json(result);
    }
    async getTradeHistory(req, res) {
        const userId = Number(req.auth.userId);
        const { start = 0, count = 10, searchParams, accountId, status } = req.query ?? {};
        if (accountId == null || accountId === "" || accountId === undefined) {
            res.status(400).json({ message: "missing_account_id" });
            return;
        }
        const result = await this.service.getTradeHistory({ userId, accountId: String(accountId), start: Number(start), count: Number(count), searchParams: searchParams, status: status });
        res.status(200).json(result);
    }
    async closeTrade(req, res) {
        const userId = Number(req.auth.userId);
        let { signalIds, isCloseAll } = req.body ?? {};
        if ((signalIds == null || signalIds.length === 0) && (isCloseAll == null || isCloseAll === undefined || isCloseAll === false)) {
            res.status(400).json({ message: "missing_signal_ids" });
            return;
        }
        if (isCloseAll == null || isCloseAll === undefined) {
            isCloseAll = false;
        }
        const result = await this.service.closeTrade(signalIds.map(Number), userId, isCloseAll);
        res.status(200).json(result);
    }
}
exports.TradeController = TradeController;
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TradeController.prototype, "getAllTrades", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TradeController.prototype, "getSingleTrade", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TradeController.prototype, "getTradeHistory", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TradeController.prototype, "closeTrade", null);
