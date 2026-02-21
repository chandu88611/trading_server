"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertSnapshotDB = void 0;
const data_source_1 = __importDefault(require("../../../../db/data-source"));
const AlertSnapshots_1 = require("../../../../entity/AlertSnapshots");
const tradeSignal_service_1 = require("../../brokerSignals/services/tradeSignal.service");
const Brokers_1 = require("../../../../entity/Brokers");
const trade_identify_1 = require("../../../../types/trade-identify");
const constants_1 = require("../../../../types/constants");
// import { CTraderService } from "../../../cTraderListener/services/cTrader";
const OPEN_STATUSES = ["pending", "running", "queued"];
class AlertSnapshotDB {
    constructor() {
        this.repo = data_source_1.default.getRepository(AlertSnapshots_1.AlertSnapshot);
        this.tradeSignalService = new tradeSignal_service_1.TradeSignalService();
        this.broker = data_source_1.default.getRepository(Brokers_1.Broker);
    }
    async create(payload, queryRunner) {
        try {
            const entity = queryRunner.manager
                .getRepository(AlertSnapshots_1.AlertSnapshot)
                .create({
                userId: payload.userId,
                ticker: payload.ticker,
                exchange: payload.exchange,
                interval: payload.interval,
                barTime: payload.barTime,
                alertTime: payload.alertTime,
                open: payload.open,
                close: payload.close,
                high: payload.high,
                low: payload.low,
                volume: payload.volume,
                currency: payload.currency ?? null,
                baseCurrency: payload.baseCurrency ?? null,
            });
            return await queryRunner.manager
                .getRepository(AlertSnapshots_1.AlertSnapshot)
                .save(entity);
        }
        catch (error) {
            throw error;
        }
    }
    async getAlertHistory(userId, query) {
        const qb = this.repo.createQueryBuilder("snapshot").where("snapshot.userId = :userId", { userId });
        if (query.ticker) {
            qb.andWhere("snapshot.ticker = :ticker", { ticker: query.ticker });
        }
        if (query.exchange) {
            qb.andWhere("snapshot.exchange = :exchange", { exchange: query.exchange });
        }
        if (query.interval) {
            qb.andWhere("snapshot.interval = :interval", { interval: query.interval });
        }
        if (query.from) {
            qb.andWhere("snapshot.alertTime >= :from", { from: query.from });
        }
        if (query.to) {
            qb.andWhere("snapshot.alertTime <= :to", { to: query.to });
        }
        qb.orderBy("snapshot.alertTime", "DESC").skip((query.page - 1) * query.limit).take(query.limit);
        return await qb.getMany();
    }
    async getBrokerId(marketType) {
        try {
            const brokerData = await this.broker.find({
                where: {
                    marketCategory: marketType,
                    isActive: true,
                },
            });
            if (!brokerData || brokerData.length === 0) {
                throw {
                    status: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "no_broker_found_for_market_type",
                };
            }
            return brokerData.map(broker => broker.id);
        }
        catch (error) {
            throw error;
        }
    }
    getMarketType(assetType) {
        switch (assetType) {
            case trade_identify_1.AssetType.FOREX:
                return trade_identify_1.MarketType.FOREX;
            case trade_identify_1.AssetType.CRYPTO:
                return trade_identify_1.MarketType.CRYPTO;
            default:
                return trade_identify_1.MarketType.INDIAN;
        }
    }
}
exports.AlertSnapshotDB = AlertSnapshotDB;
