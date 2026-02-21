"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeSignalDB = void 0;
const TradeSignals_1 = require("../../../../entity/TradeSignals");
const trade_identify_1 = require("../../../../types/trade-identify");
const TradeSignalsStatus_1 = require("../../../../entity/TradeSignalsStatus");
class TradeSignalDB {
    async createTradeSignal(alertData, queryRunner) {
        try {
            const createdSignals = alertData.map((data) => {
                return {
                    userId: data.userId,
                    tradingAccountId: data.tradingAccountId,
                    alertSnapshotsId: data.alertSnapshotsId,
                    action: data.action,
                    symbol: data.symbol,
                    price: data.price,
                    exchange: data.exchange,
                    signalTime: new Date(),
                    volume: data.volume,
                    assetType: trade_identify_1.AssetClassifier.detect({
                        symbol: data.symbol,
                        exchange: data.exchange,
                    }),
                };
            });
            const entity = queryRunner.manager
                .getRepository(TradeSignals_1.TradeSignal)
                .create(createdSignals);
            const savedSignals = await queryRunner.manager
                .getRepository(TradeSignals_1.TradeSignal)
                .save(entity);
            let StatusEntity = savedSignals.map((signal) => {
                return {
                    tradeSignalId: signal.id,
                    status: "pending",
                };
            });
            const statusEntityData = queryRunner.manager.getRepository(TradeSignalsStatus_1.TradeSignalStatus).create(StatusEntity);
            await queryRunner.manager.getRepository(TradeSignalsStatus_1.TradeSignalStatus).save(statusEntityData);
            return entity;
        }
        catch (error) {
            throw error;
        }
    }
}
exports.TradeSignalDB = TradeSignalDB;
