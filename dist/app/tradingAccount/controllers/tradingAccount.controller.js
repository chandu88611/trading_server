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
exports.TradingAccountController = void 0;
const error_handler_1 = require("../../../types/error-handler");
const tradingAccount_service_1 = require("../services/tradingAccount.service");
class TradingAccountController {
    constructor() {
        this.service = new tradingAccount_service_1.TradingAccountService();
    }
    async listMyAccounts(req, res) {
        const userId = Number(req.auth.userId);
        const accounts = await this.service.listMyAccounts(userId);
        res.json({ accounts });
    }
    async getMyAccountById(req, res) {
        const userId = Number(req.auth.userId);
        const accountId = Number(req.params.id);
        if (!accountId) {
            res.status(400).json({ message: "missing_account_id" });
            return;
        }
        const account = await this.service.getMyAccountById(userId, accountId);
        res.json({ account });
    }
    async createMyAccount(req, res) {
        const userId = Number(req.auth.userId);
        const payload = req.body ?? {};
        if (!payload.accountLabel) {
            res.status(400).json({ message: "missing_required_fields" });
            return;
        }
        const account = await this.service.createMyAccount(userId, payload);
        res.status(201).json({ account });
    }
    async updateMyAccount(req, res) {
        const userId = Number(req.auth.userId);
        const accountId = Number(req.params.id);
        const payload = req.body ?? {};
        if (!accountId) {
            res.status(400).json({ message: "missing_account_id" });
            return;
        }
        const account = await this.service.updateMyAccount(userId, accountId, payload);
        res.json({ account });
    }
    async deleteMyAccount(req, res) {
        const userId = Number(req.auth.userId);
        const accountId = Number(req.params.id);
        if (!accountId) {
            res.status(400).json({ message: "missing_account_id" });
            return;
        }
        await this.service.deleteMyAccount(userId, accountId);
        res.status(204).send();
    }
}
exports.TradingAccountController = TradingAccountController;
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TradingAccountController.prototype, "listMyAccounts", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TradingAccountController.prototype, "getMyAccountById", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TradingAccountController.prototype, "createMyAccount", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TradingAccountController.prototype, "updateMyAccount", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TradingAccountController.prototype, "deleteMyAccount", null);
