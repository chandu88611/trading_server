"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyDBService = void 0;
const data_source_1 = __importDefault(require("../../db/data-source"));
const Strategy_1 = require("../../entity/Strategy");
class StrategyDBService {
    constructor() {
        this.repo = data_source_1.default.getRepository(Strategy_1.Strategy);
    }
    async create(payload) {
        if (!payload?.name?.trim())
            throw { statusCode: 400, message: "name required" };
        if (!payload?.category?.trim())
            throw { statusCode: 400, message: "category required" };
        const row = this.repo.create({
            name: payload.name.trim(),
            description: payload.description ?? null,
            category: payload.category.trim(),
            risk: payload.risk ?? "Medium",
            marketCodes: Array.isArray(payload.marketCodes) ? payload.marketCodes : [],
            avgMonthlyReturnPct: payload.avgMonthlyReturnPct ?? 0,
            winRatePct: payload.winRatePct ?? 0,
            maxDrawdownPct: payload.maxDrawdownPct ?? 0,
            isActive: payload.isActive ?? true,
        });
        return this.repo.save(row);
    }
    list(query) {
        return this.repo.find({
            where: query.isActive === undefined ? {} : { isActive: query.isActive },
            order: { createdAt: "DESC" },
        });
    }
}
exports.StrategyDBService = StrategyDBService;
