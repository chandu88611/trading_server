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
exports.CopyTradingController = void 0;
const error_handler_1 = require("../../../types/error-handler");
const constants_1 = require("../../../types/constants");
const copyTrading_service_1 = require("../services/copyTrading.service");
function toInt(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}
function getUserId(req) {
    const userId = Number(req.auth.userId);
    return userId && Number.isFinite(userId) ? userId : null;
}
function parseVisibility(v, fallback = "public") {
    const s = String(v || "")
        .trim()
        .toLowerCase();
    if (s === "private" || s === "unlisted" || s === "public")
        return s;
    return fallback;
}
class CopyTradingController {
    constructor() {
        this.service = new copyTrading_service_1.CopyTradingService();
    }
    async upsertMyMaster(req, res) {
        const userId = getUserId(req);
        if (!userId) {
            return res
                .status(constants_1.HttpStatusCode._UNAUTHORISED)
                .json({ message: "unauthorized" });
        }
        const tradingAccountId = toInt(req.body?.tradingAccountId);
        if (!tradingAccountId) {
            return res
                .status(constants_1.HttpStatusCode._BAD_REQUEST)
                .json({ message: "tradingAccountId_required" });
        }
        const out = await this.service.upsertMyMaster({
            userId: Number(userId),
            tradingAccountId,
            name: req.body?.name,
            description: req.body?.description,
            visibility: req.body?.visibility,
            requiresApproval: Boolean(req.body?.requiresApproval),
        });
        return res.status(constants_1.HttpStatusCode._SUCCESS).json(out);
    }
    /**
     * Get my master profile (create default if needed)
     */
    async getMyMaster(req, res) {
        const userId = getUserId(req);
        if (!userId) {
            return res
                .status(constants_1.HttpStatusCode._UNAUTHORISED)
                .json({ message: "unauthorized" });
        }
        const out = await this.service.getMyMaster(Number(userId));
        return res.status(constants_1.HttpStatusCode._SUCCESS).json(out);
    }
    async listMasters(req, res) {
        const userId = getUserId(req);
        const page = Math.max(1, toInt(req.query?.page, 1));
        const limit = Math.min(100, Math.max(1, toInt(req.query?.limit, 20)));
        const visibility = parseVisibility(req.query?.visibility, "public");
        const out = await this.service.listMasters({
            viewerUserId: userId ? Number(userId) : undefined,
            visibility,
            page,
            limit,
        });
        return res.status(constants_1.HttpStatusCode._SUCCESS).json(out);
    }
    async followMaster(req, res) {
        const userId = getUserId(req);
        if (!userId) {
            return res
                .status(constants_1.HttpStatusCode._UNAUTHORISED)
                .json({ message: "unauthorized" });
        }
        const masterId = toInt(req.body?.masterId);
        const followerTradingAccountId = toInt(req.body?.followerTradingAccountId);
        if (!masterId || !followerTradingAccountId) {
            return res
                .status(constants_1.HttpStatusCode._BAD_REQUEST)
                .json({ message: "masterId_and_followerTradingAccountId_required" });
        }
        const out = await this.service.followMaster({
            followerUserId: Number(userId),
            masterId,
            followerTradingAccountId,
            subscriptionId: req.body?.subscriptionId
                ? toInt(req.body?.subscriptionId)
                : undefined,
            riskMode: req.body?.riskMode,
            riskValue: req.body?.riskValue,
            maxLot: req.body?.maxLot,
            maxOpenPositions: req.body?.maxOpenPositions,
            maxDailyLoss: req.body?.maxDailyLoss,
            slippageTolerance: req.body?.slippageTolerance,
            symbolWhitelist: req.body?.symbolWhitelist,
        });
        return res.status(constants_1.HttpStatusCode._SUCCESS).json(out);
    }
    async listMyFollows(req, res) {
        const userId = getUserId(req);
        if (!userId) {
            return res
                .status(constants_1.HttpStatusCode._UNAUTHORISED)
                .json({ message: "unauthorized" });
        }
        const page = Math.max(1, toInt(req.query?.page, 1));
        const limit = Math.min(100, Math.max(1, toInt(req.query?.limit, 20)));
        const status = req.query?.status
            ? String(req.query?.status)
            : undefined;
        const out = await this.service.listMyFollows({
            followerUserId: Number(userId),
            page,
            limit,
            status,
        });
        return res.status(constants_1.HttpStatusCode._SUCCESS).json(out);
    }
    async updateMyFollow(req, res) {
        const userId = getUserId(req);
        if (!userId) {
            return res
                .status(constants_1.HttpStatusCode._UNAUTHORISED)
                .json({ message: "unauthorized" });
        }
        const followId = toInt(req.params?.followId);
        if (!followId) {
            return res
                .status(constants_1.HttpStatusCode._BAD_REQUEST)
                .json({ message: "followId_required" });
        }
        const out = await this.service.updateMyFollow({
            followerUserId: Number(userId),
            followId,
            status: req.body?.status,
            riskMode: req.body?.riskMode,
            riskValue: req.body?.riskValue,
            maxLot: req.body?.maxLot,
            maxOpenPositions: req.body?.maxOpenPositions,
            maxDailyLoss: req.body?.maxDailyLoss,
            slippageTolerance: req.body?.slippageTolerance,
            symbolWhitelist: req.body?.symbolWhitelist,
        });
        return res.status(constants_1.HttpStatusCode._SUCCESS).json(out);
    }
    async listMyFollowers(req, res) {
        const userId = getUserId(req);
        if (!userId) {
            return res
                .status(constants_1.HttpStatusCode._UNAUTHORISED)
                .json({ message: "unauthorized" });
        }
        const page = Math.max(1, toInt(req.query?.page, 1));
        const limit = Math.min(100, Math.max(1, toInt(req.query?.limit, 20)));
        const status = req.query?.status
            ? String(req.query?.status)
            : undefined;
        const out = await this.service.listMyFollowers({
            ownerUserId: Number(userId),
            page,
            limit,
            status,
        });
        return res.status(constants_1.HttpStatusCode._SUCCESS).json(out);
    }
    async decideFollowerRequest(req, res) {
        const userId = getUserId(req);
        if (!userId) {
            return res
                .status(constants_1.HttpStatusCode._UNAUTHORISED)
                .json({ message: "unauthorized" });
        }
        const followId = toInt(req.params?.followId);
        const action = String(req.body?.action || "").toLowerCase();
        if (!followId || !["approve", "reject"].includes(action)) {
            return res
                .status(constants_1.HttpStatusCode._BAD_REQUEST)
                .json({ message: "followId_and_valid_action_required" });
        }
        const out = await this.service.decideFollowerRequest({
            ownerUserId: Number(userId),
            followId,
            action: action,
        });
        return res.status(constants_1.HttpStatusCode._SUCCESS).json(out);
    }
}
exports.CopyTradingController = CopyTradingController;
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CopyTradingController.prototype, "upsertMyMaster", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CopyTradingController.prototype, "getMyMaster", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CopyTradingController.prototype, "listMasters", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CopyTradingController.prototype, "followMaster", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CopyTradingController.prototype, "listMyFollows", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CopyTradingController.prototype, "updateMyFollow", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CopyTradingController.prototype, "listMyFollowers", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CopyTradingController.prototype, "decideFollowerRequest", null);
