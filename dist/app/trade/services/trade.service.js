"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeService = void 0;
// src/app/trade/services/trade.service.ts
const data_source_1 = __importDefault(require("../../../db/data-source"));
const trade_db_1 = require("./trade.db");
class TradeService {
    constructor() {
        this.db = new trade_db_1.TradeDBService();
    }
    async getAllTradesForUser({ userId, accountId, start, count, searchParams, status }) {
        return this.db.getAllTradeForUser({ userId, accountId, start, count, searchParams, status });
    }
    async getSignalStatusForTrade(signalId) {
        return this.db.getSignalStatusForTrade(signalId);
    }
    async getTradeHistory({ userId, accountId, start, count, searchParams, status }) {
        return this.db.getHistoryForTrade({ userId, accountId, start, count, searchParams, status });
    }
    async closeTrade(signalIds, userId, isCloseAll) {
        const queryRunner = data_source_1.default.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const result = await this.db.closeTrade(signalIds, userId, isCloseAll, queryRunner);
            await queryRunner.commitTransaction();
            return result;
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async listAdminStrategyTrades(query) {
        return this.db.listAdminStrategyTrades(query);
    }
    async getAdminStrategyTrade(adminStrategyTradeId) {
        return this.db.getAdminStrategyTrade(adminStrategyTradeId);
    }
    async closeAdminStrategyTrade(adminStrategyTradeId) {
        const queryRunner = data_source_1.default.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const result = await this.db.closeAdminStrategyTrade(adminStrategyTradeId, queryRunner);
            await queryRunner.commitTransaction();
            return result;
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
}
exports.TradeService = TradeService;
