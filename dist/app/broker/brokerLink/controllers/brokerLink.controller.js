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
exports.BrokerLinkController = void 0;
const error_handler_1 = require("../../../../types/error-handler");
const brokerLink_service_1 = require("../services/brokerLink.service");
class BrokerLinkController {
    constructor() {
        this.service = new brokerLink_service_1.BrokerLinkService();
    }
    async listBrokersForAccount(req, res) {
        const tradingAccountId = Number(req.params.accountId);
        if (!tradingAccountId) {
            res.status(400).json({ message: "missing_trading_account_id" });
            return;
        }
        const brokers = await this.service.listBrokersForAccount(tradingAccountId);
        res.json({ brokers });
    }
    async linkBrokerToAccount(req, res) {
        const tradingAccountId = Number(req.params.accountId);
        const { brokerId } = req.body ?? {};
        if (!tradingAccountId || !brokerId) {
            res.status(400).json({ message: "missing_required_fields" });
            return;
        }
        const link = await this.service.linkBrokerToAccount(tradingAccountId, Number(brokerId));
        res.status(201).json({ link });
    }
    async unlinkBrokerFromAccount(req, res) {
        const tradingAccountId = Number(req.params.tradingAccountId);
        const brokerId = Number(req.params.brokerId);
        if (!tradingAccountId || !brokerId) {
            res.status(400).json({ message: "missing_required_fields" });
            return;
        }
        await this.service.unlinkBrokerFromAccount(tradingAccountId, brokerId);
        res.status(204).send();
    }
}
exports.BrokerLinkController = BrokerLinkController;
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BrokerLinkController.prototype, "listBrokersForAccount", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BrokerLinkController.prototype, "linkBrokerToAccount", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BrokerLinkController.prototype, "unlinkBrokerFromAccount", null);
