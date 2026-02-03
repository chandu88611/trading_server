"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeSignalDB = void 0;
const data_source_1 = __importDefault(require("../../../../db/data-source"));
const TradeSignals_1 = require("../../../../entity/TradeSignals");
const entity_1 = require("../../../../entity");
const trade_identify_1 = require("../../../../types/trade-identify");
class TradeSignalDB {
    constructor() {
        this.repo = data_source_1.default.getRepository(TradeSignals_1.TradeSignal);
        this.jobRepo = data_source_1.default.getRepository(entity_1.BrokerJob);
    }
    async createTradeSignal(alertData, queryRunner) {
        try {
            const entity = queryRunner.manager.getRepository(TradeSignals_1.TradeSignal).create({
                jobId: alertData.jobId,
                action: alertData.action,
                symbol: alertData.symbol,
                price: alertData.price,
                exchange: alertData.exchange,
                signalTime: alertData.signalTime,
                assetType: trade_identify_1.AssetClassifier.detect({
                    symbol: alertData.symbol,
                    exchange: alertData.exchange,
                }),
            });
            await queryRunner.manager.getRepository(TradeSignals_1.TradeSignal).save(entity);
            return entity;
        }
        catch (error) {
            throw error;
        }
    }
    async create(payload) {
        const job = await this.jobRepo.findOne({ where: { id: payload.jobId } });
        if (!job)
            throw new Error("job_not_found");
        const entity = this.repo.create({
            brokerJob: { id: payload.jobId },
            action: payload.action,
            symbol: payload.symbol,
            price: payload.price,
            exchange: payload.exchange,
            signalTime: payload.signalTime,
        });
        return this.repo.save(entity);
    }
    async listByJob(jobId) {
        return this.repo.find({
            where: { brokerJob: { id: jobId } },
            order: { createdAt: "DESC" },
        });
    }
}
exports.TradeSignalDB = TradeSignalDB;
