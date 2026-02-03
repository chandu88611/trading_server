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
const enums_1 = require("../../../db/enums");
class TradeController {
    constructor() {
        this.service = new trade_service_1.TradeService();
    }
    async create(req, res) {
        const userId = Number(req.auth.userId);
        const { tradingAccountId, symbol, side, quantity, price, exchange } = req.body ?? {};
        // Validate required fields
        if (!tradingAccountId || !symbol || !side || !quantity) {
            res.status(400).json({ message: "missing_required_fields" });
            return;
        }
        // Validate quantity is positive
        if (Number(quantity) <= 0) {
            res.status(400).json({ message: "invalid_quantity" });
            return;
        }
        // Validate side enum
        if (!Object.values(enums_1.CopyTradeSideEnum).includes(side)) {
            res.status(400).json({ message: "invalid_side" });
            return;
        }
        const result = await this.service.createTrade(userId, {
            tradingAccountId: Number(tradingAccountId),
            symbol: String(symbol),
            side: side,
            quantity: Number(quantity),
            price: price != null ? Number(price) : null,
            exchange: exchange ?? null,
        });
        if (!result.ok && result.blocked) {
            res.status(403).json({
                message: "trade_not_allowed",
                reason: result.reason,
            });
            return;
        }
        res.status(201).json(result);
    }
}
exports.TradeController = TradeController;
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TradeController.prototype, "create", null);
