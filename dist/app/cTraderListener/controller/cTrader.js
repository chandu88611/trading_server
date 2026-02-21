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
exports.CTraderController = void 0;
const error_handler_1 = require("../../../types/error-handler");
const cTrader_1 = require("../services/cTrader");
class CTraderController {
    constructor() {
        this.service = new cTrader_1.CTraderService();
    }
    parsePositiveInt(value) {
        const num = Number(value);
        if (!Number.isFinite(num) || num <= 0)
            return null;
        return num;
    }
    async generateTokens(req, res) {
        try {
            const code = String(req.body?.code ?? "").trim();
            const accountIdRaw = req.body?.accountId ?? req.body?.account_id;
            const accountId = this.parsePositiveInt(accountIdRaw);
            if (!code) {
                return res.status(400).json({ error: "code_required" });
            }
            if (!accountId) {
                return res.status(400).json({ error: "accountId_required" });
            }
            const result = await this.service.completeOAuthAndVerifyByCTraderAccountId(String(accountId), code);
            if (!result.ok) {
                return res.status(result.status ?? 502).json({
                    error: "ctrader_oauth_exchange_failed",
                    details: result.details ?? result.error,
                });
            }
            return res.status(200).json({
                message: "cTrader connected",
                data: {
                    accountId,
                    userId: result.userId,
                    rowId: result.rowId,
                    ctraderAccountId: result.ctraderAccountId,
                },
            });
        }
        catch (error) {
            return res.status(500).json({
                error: "Failed to generate tokens",
                details: error?.message ?? String(error),
            });
        }
    }
    async oauthCallback(req, res) {
        try {
            const code = String(req.query?.code ?? "").trim();
            const state = String(req.query?.state ?? "").trim();
            if (!code)
                return res.status(400).json({ error: "code_required" });
            if (!state)
                return res.status(400).json({ error: "state_required" });
            const accountId = this.parsePositiveInt(state);
            if (!accountId) {
                return res.status(400).json({ error: "invalid_state_accountId" });
            }
            const result = await this.service.completeOAuthAndVerifyByCTraderAccountId(state, code);
            if (!result.ok) {
                return res.status(result.status).json({ error: result.error, details: result.details });
            }
            // return res.status(200).json({
            //   message: "cTrader OAuth callback processed",
            //   data: {
            //     accountId,
            //     userId: result.userId,
            //     rowId: result.rowId,
            //     ctraderAccountId: result.ctraderAccountId,
            //   },
            // });
            // redirect to https://tradebro.io/profile
            return res.redirect("https://tradebro.io/profile");
        }
        catch (error) {
            return res.status(500).json({
                error: "Failed to handle OAuth callback",
                details: error?.message ?? String(error),
            });
        }
    }
}
exports.CTraderController = CTraderController;
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CTraderController.prototype, "generateTokens", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CTraderController.prototype, "oauthCallback", null);
