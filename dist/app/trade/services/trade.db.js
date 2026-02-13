"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeDBService = void 0;
// src/app/trade/services/trade.db.ts
const data_source_1 = __importDefault(require("../../../db/data-source"));
const entities_1 = require("../../../entities");
const constants_1 = require("../../../types/constants");
class TradeDBService {
    constructor() {
        this.snapshotRepo = data_source_1.default.getRepository(entities_1.AlertSnapshot);
        this.signalRepo = data_source_1.default.getRepository(entities_1.TradeSignal);
    }
    async logSignal(params) {
        try {
            const now = new Date();
            // minimal snapshot, many fields nullable in schema
            const snapshot = this.snapshotRepo.create({
                userId: params.userId,
                ticker: params.symbol,
                exchange: params.exchange ?? null,
                interval: "TRADE",
                barTime: now,
                alertTime: now,
                open: null,
                close: params.price != null ? String(params.price) : null,
                high: null,
                low: null,
                volume: null,
                currency: null,
                baseCurrency: null,
            });
            const savedSnap = await this.snapshotRepo.save(snapshot);
            const savedSnapId = (Array.isArray(savedSnap) ? savedSnap[0] : savedSnap).id;
            const signal = this.signalRepo.create({
                alertSnapshotId: savedSnapId,
                action: params.side,
                symbol: params.symbol,
                price: params.price != null ? String(params.price) : null,
                exchange: params.exchange ?? null,
                assetType: String(params.assetType),
                signalTime: now,
            });
            return await this.signalRepo.save(signal);
        }
        catch (error) {
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "database_error_logging_signal",
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async logSignalWithRunner(params, queryRunner) {
        try {
            const now = new Date();
            // minimal snapshot, many fields nullable in schema
            const snapshot = queryRunner.manager.create(entities_1.AlertSnapshot, {
                userId: params.userId,
                ticker: params.symbol,
                exchange: params.exchange ?? null,
                interval: "TRADE",
                barTime: now,
                alertTime: now,
                open: null,
                close: params.price != null ? String(params.price) : null,
                high: null,
                low: null,
                volume: null,
                currency: null,
                baseCurrency: null,
            });
            const savedSnap = await queryRunner.manager.save(snapshot);
            const savedSnapId = (Array.isArray(savedSnap) ? savedSnap[0] : savedSnap).id;
            const signal = queryRunner.manager.create(entities_1.TradeSignal, {
                alertSnapshotId: savedSnapId,
                action: params.side,
                symbol: params.symbol,
                price: params.price != null ? String(params.price) : null,
                exchange: params.exchange ?? null,
                assetType: String(params.assetType),
                signalTime: now,
            });
            return await queryRunner.manager.save(signal);
        }
        catch (error) {
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "database_error_logging_signal",
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async getAllTradeForUser({ userId, start, count }) {
        return this.signalRepo.find({
            where: { alertSnapshot: { userId } },
            order: { createdAt: "DESC" },
            skip: start,
            take: count,
        });
    }
}
exports.TradeDBService = TradeDBService;
