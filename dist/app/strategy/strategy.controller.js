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
exports.StrategyController = void 0;
const error_handler_1 = require("../../types/error-handler");
const strategy_1 = require("./strategy");
const auth_1 = require("../../middleware/auth");
const constants_1 = require("../../types/constants");
class StrategyController {
    constructor() {
        this.service = new strategy_1.StrategyService();
    }
    isAdmin(req) {
        const roles = req.auth?.roles ?? [];
        return roles.includes(auth_1.Roles.ADMIN);
    }
    ensureAdmin(req) {
        if (!this.isAdmin(req)) {
            throw {
                statusCode: constants_1.HttpStatusCode._UNAUTHORISED,
                message: "Admin access required",
            };
        }
    }
    parseOptionalBoolean(value, fieldName) {
        if (value === undefined)
            return undefined;
        const raw = Array.isArray(value) ? value[0] : value;
        if (typeof raw === "boolean")
            return raw;
        const normalized = String(raw).trim().toLowerCase();
        if (normalized === "true")
            return true;
        if (normalized === "false")
            return false;
        throw {
            statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
            message: `${fieldName} must be a boolean`,
        };
    }
    parseOptionalNumber(value, fallback) {
        if (value === undefined)
            return fallback;
        const raw = Array.isArray(value) ? value[0] : value;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    async list(req, res) {
        const isAdmin = this.isAdmin(req);
        const query = req.query;
        const result = await this.service.list({
            availableOnly: !isAdmin,
            isActive: isAdmin
                ? this.parseOptionalBoolean(query.isActive, "isActive")
                : undefined,
            isDeprecated: isAdmin
                ? this.parseOptionalBoolean(query.isDeprecated, "isDeprecated")
                : undefined,
            category: query.category ? String(query.category) : undefined,
            searchParam: query.searchParam ? String(query.searchParam) : undefined,
            chunkSize: this.parseOptionalNumber(query.chunkSize, 20),
            initialOffset: this.parseOptionalNumber(query.initialOffset, 0),
        });
        res.status(200).json({
            message: "Fetched strategies",
            data: result.rows,
            total: result.total,
        });
    }
    async create(req, res) {
        this.ensureAdmin(req);
        const s = await this.service.create(req.body);
        res.status(201).json({ message: "Strategy created", data: s });
    }
    async get(req, res) {
        const strategyId = Number(req.params.strategyId);
        const data = await this.service.getById(strategyId, {
            availableOnly: !this.isAdmin(req),
            userId: req.auth?.userId ? Number(req.auth.userId) : null,
        });
        res.status(200).json({ message: "Fetched strategy", data });
    }
    async subscribe(req, res) {
        const userId = Number(req.auth.userId);
        const strategyId = Number(req.params.strategyId);
        const data = await this.service.subscribe(userId, strategyId, req.body ?? {});
        res.status(200).json({ message: "strategy_subscription_saved", data });
    }
    async myPerformance(req, res) {
        const userId = Number(req.auth.userId);
        const strategyId = Number(req.params.strategyId);
        const accountId = req.query.accountId === undefined || req.query.accountId === ""
            ? null
            : Number(req.query.accountId);
        const data = await this.service.getMyPerformance(userId, strategyId, accountId);
        res.status(200).json({ message: "strategy_my_performance", data });
    }
    async update(req, res) {
        this.ensureAdmin(req);
        const strategyId = Number(req.params.strategyId);
        const data = await this.service.update(strategyId, req.body);
        res.status(200).json({ message: "Strategy updated", data });
    }
    async retire(req, res) {
        this.ensureAdmin(req);
        const strategyId = Number(req.params.strategyId);
        const data = await this.service.retire(strategyId);
        res.status(200).json({ message: "Strategy retired", data });
    }
    async enableStrategy(req, res) {
        const strategyId = Number(req.params.strategyId);
        if (this.isAdmin(req)) {
            const data = await this.service.setStrategyActive(strategyId, true);
            res.status(200).json({ message: "strategy_enabled", data });
            return;
        }
        const userId = Number(req.auth.userId);
        const data = await this.service.setUserStrategyStatusByStrategyId(userId, strategyId, "active");
        res.status(200).json({ message: "user_strategy_enabled", data });
    }
    async disableStrategy(req, res) {
        const strategyId = Number(req.params.strategyId);
        if (this.isAdmin(req)) {
            const data = await this.service.setStrategyActive(strategyId, false);
            res.status(200).json({ message: "strategy_disabled", data });
            return;
        }
        const userId = Number(req.auth.userId);
        const data = await this.service.setUserStrategyStatusByStrategyId(userId, strategyId, "paused");
        res.status(200).json({ message: "user_strategy_disabled", data });
    }
    async enableUserStrategyInstance(req, res) {
        const userId = Number(req.auth.userId);
        const instanceId = Number(req.params.instanceId);
        const data = await this.service.setUserStrategyInstanceStatus(userId, instanceId, "active");
        res.status(200).json({ message: "user_strategy_enabled", data });
    }
    async disableUserStrategyInstance(req, res) {
        const userId = Number(req.auth.userId);
        const instanceId = Number(req.params.instanceId);
        const data = await this.service.setUserStrategyInstanceStatus(userId, instanceId, "paused");
        res.status(200).json({ message: "user_strategy_disabled", data });
    }
    async updateUserStrategyInstanceVolume(req, res) {
        const userId = Number(req.auth.userId);
        const instanceId = Number(req.params.instanceId);
        const volume = Number(req.body?.volume);
        const data = await this.service.setUserStrategyInstanceVolume(userId, instanceId, volume);
        res.status(200).json({ message: "user_strategy_volume_updated", data });
    }
}
exports.StrategyController = StrategyController;
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StrategyController.prototype, "list", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StrategyController.prototype, "create", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StrategyController.prototype, "get", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StrategyController.prototype, "subscribe", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StrategyController.prototype, "myPerformance", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StrategyController.prototype, "update", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StrategyController.prototype, "retire", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StrategyController.prototype, "enableStrategy", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StrategyController.prototype, "disableStrategy", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StrategyController.prototype, "enableUserStrategyInstance", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StrategyController.prototype, "disableUserStrategyInstance", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StrategyController.prototype, "updateUserStrategyInstanceVolume", null);
