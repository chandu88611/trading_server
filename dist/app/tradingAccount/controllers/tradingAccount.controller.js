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
    asObject(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return {};
        }
        return { ...value };
    }
    firstNonEmptyString(...values) {
        for (const value of values) {
            if (value === undefined || value === null)
                continue;
            const normalized = String(value).trim();
            if (normalized)
                return normalized;
        }
        return undefined;
    }
    normalizeIndianMarketFields(payload) {
        const brokerCode = this.firstNonEmptyString(payload.broker)?.toUpperCase();
        const meta = this.asObject(payload.accountMeta);
        const brokerMetaKey = brokerCode ? brokerCode.toLowerCase() : "";
        const brokerMeta = brokerMetaKey ? this.asObject(meta[brokerMetaKey]) : {};
        const clientId = this.firstNonEmptyString(payload.clientId, meta.clientId, meta.accountId, meta.dhanClientId, brokerMeta.clientId, brokerMeta.accountId);
        const apiKey = this.firstNonEmptyString(payload.apiKey, payload.vendorCode, meta.apiKey, meta.vendorCode, brokerMeta.apiKey, brokerMeta.vendorCode);
        const appKey = this.firstNonEmptyString(payload.appKey, payload.apiSecret, meta.appKey, meta.apiSecret, brokerMeta.appKey, brokerMeta.apiSecret);
        if (clientId) {
            meta.clientId = clientId;
            if (!meta.accountId)
                meta.accountId = clientId;
            if (!meta.dhanClientId)
                meta.dhanClientId = clientId;
        }
        if (apiKey) {
            meta.apiKey = apiKey;
            if (!meta.vendorCode)
                meta.vendorCode = apiKey;
        }
        if (appKey) {
            meta.appKey = appKey;
            if (!meta.apiSecret)
                meta.apiSecret = appKey;
        }
        if (brokerMetaKey) {
            const nextBrokerMeta = { ...brokerMeta };
            if (clientId) {
                nextBrokerMeta.clientId = clientId;
                if (!nextBrokerMeta.accountId)
                    nextBrokerMeta.accountId = clientId;
            }
            if (apiKey) {
                nextBrokerMeta.apiKey = apiKey;
                if (!nextBrokerMeta.vendorCode)
                    nextBrokerMeta.vendorCode = apiKey;
            }
            if (appKey) {
                nextBrokerMeta.appKey = appKey;
                if (!nextBrokerMeta.apiSecret)
                    nextBrokerMeta.apiSecret = appKey;
            }
            if (Object.keys(nextBrokerMeta).length > 0) {
                meta[brokerMetaKey] = nextBrokerMeta;
            }
        }
        payload.accountMeta = meta;
        if (!payload.accountId && clientId) {
            payload.accountId = clientId;
        }
    }
    async listMyAccounts(req, res) {
        const userId = Number(req.auth.userId);
        const planIdRaw = req.query.planId;
        if (planIdRaw === undefined || planIdRaw === null || planIdRaw.trim() === "") {
            res.status(400).json({ message: "missing_plan_id" });
            return;
        }
        const planId = Number(planIdRaw);
        if (!Number.isFinite(planId) || planId <= 0) {
            res.status(400).json({ message: "invalid_plan_id" });
            return;
        }
        const accounts = await this.service.listMyAccounts(userId, planId);
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
        console.log("Received request to create trading account with payload", { userId, payload });
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
    // @ControllerError()
    // async allowCopyTrading(req: AuthRequest, res: Response) {
    //   const userId = Number(req.auth!.userId);
    //   const payload: { allow: boolean, userTradingAccountId: number, masterAccountId: number } = req.body ?? {};
    //   if (payload.allow === undefined) {
    //     res.status(400).json({ message: "missing_allow_field" });
    //     return;
    //   }
    //   // await this.service.setCopyTradingPermission(userId, payload.allow);
    //   res.json({ message: `you allowed copy trading ${payload.allow} for userTradingAccountId ${payload.userTradingAccountId} and masterAccountId ${payload.masterAccountId}` });
    // }
    // @ControllerError()
    // async handleCopyTradingRequest(req: AuthRequest, res: Response) {
    //   const userId = Number(req.auth!.userId);
    //   const payload: { userTradingAccountId: number, userEmail: string, masterAccountId: number } = req.body ?? {};
    //     if (!payload.userTradingAccountId || !payload.userEmail || !payload.masterAccountId) {
    //       res.status(400).json({ message: "missing_required_fields" });
    //       return;
    //     }
    //   // await this.service.handleCopyTradingRequest(userId, payload.requestId, payload.accept);
    //   res.json({ message: `you handled copy trading request for userTradingAccountId ${payload.userTradingAccountId} and masterAccountId ${payload.masterAccountId}` });
    // }
    async getCopyTradingRequests(req, res) {
        console.log("Received request to get copy trading requests", { userId: req.auth.userId });
        const userId = Number(req.auth.userId);
        let { count, start, searchParams } = req.query ?? {};
        if (count === undefined) {
            count = '10';
        }
        if (start === undefined) {
            start = '0';
        }
        const requests = await this.service.getCopyTradingRequests(userId);
        res.json({ requests });
    }
    async handleCopyTradingRequest(req, res) {
        const userId = Number(req.auth.userId);
        const payload = req.body ?? {};
        if (!payload.userTradingAccountId || !payload.userEmail) {
            res.status(400).json({ message: "missing_required_fields" });
            return;
        }
        await this.service.makingCopyTradingRequestToMasterFromFollower({ userId, userTradingAccountId: payload.userTradingAccountId, userEmail: payload.userEmail });
        res.json({ message: `you made copy trading request from userTradingAccountId ${payload.userTradingAccountId}` });
    }
    async allowCopyTrading(req, res) {
        const userId = Number(req.auth.userId);
        const payload = req.body ?? {};
        if (!payload.requestId || payload.approve === undefined) {
            res.status(400).json({ message: "missing_required_fields" });
            return;
        }
        await this.service.approveCopyTradingRequestFromFollower(payload.requestId, payload.approve);
        res.json({ message: `you ${payload.approve ? 'approved' : 'rejected'} copy trading request ${payload.requestId}` });
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
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TradingAccountController.prototype, "getCopyTradingRequests", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TradingAccountController.prototype, "handleCopyTradingRequest", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TradingAccountController.prototype, "allowCopyTrading", null);
