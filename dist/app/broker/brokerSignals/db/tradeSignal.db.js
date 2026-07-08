"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeSignalDB = void 0;
const TradeSignals_1 = require("../../../../entity/TradeSignals");
const trade_identify_1 = require("../../../../types/trade-identify");
const TradeSignalsStatus_1 = require("../../../../entity/TradeSignalsStatus");
const tradeAlert_db_1 = require("../../../trade/services/tradeAlert.db");
class TradeSignalDB {
    constructor() {
        this.tradeAlertDb = new tradeAlert_db_1.TradeAlertDBService();
    }
    async createTradeSignal(alertData, queryRunner) {
        try {
            const createdSignals = alertData.map((data) => {
                return {
                    userId: data.userId,
                    tradingAccountId: data.tradingAccountId,
                    alertSnapshotsId: data.alertSnapshotsId,
                    adminStrategyTradeId: data.adminStrategyTradeId ?? null,
                    strategyId: data.strategyId ?? null,
                    planId: data.planId ?? null,
                    subscriptionId: data.subscriptionId ?? null,
                    action: data.action,
                    symbol: data.symbol,
                    price: data.price,
                    exchange: data.exchange,
                    signalTime: data.signalTime,
                    volume: data.volume,
                    assetType: trade_identify_1.AssetClassifier.detect({
                        symbol: data.symbol,
                        exchange: data.exchange,
                    }),
                    // Indian-market instrument classification (explicit)
                    instrumentType: data.instrumentType ?? null,
                    product: data.product ?? null,
                    underlying: data.underlying ?? null,
                    expiry: data.expiry ?? null,
                    optionType: data.optionType ?? null,
                    strike: data.strike ?? null,
                    tradingSymbol: data.tradingSymbol ?? null,
                    sourceAction: data.sourceAction ?? null,
                    brokerInstrumentId: data.brokerInstrumentId ?? null,
                    instrumentToken: data.instrumentToken ?? null,
                    tickSize: data.tickSize ?? null,
                    executionMode: data.executionMode ?? null,
                    entryRef: data.entryRef ?? null,
                    orderType: data.orderType ?? null,
                    limitPrice: data.limitPrice ?? null,
                    stopPrice: data.stopPrice ?? null,
                    stopLoss: data.stopLoss ?? null,
                    takeProfit: data.takeProfit ?? null,
                    stopLossDistance: data.stopLossDistance ?? null,
                    takeProfitDistance: data.takeProfitDistance ?? null,
                    stopLossAmount: data.stopLossAmount ?? null,
                    takeProfitAmount: data.takeProfitAmount ?? null,
                    trailingStopLoss: data.trailingStopLoss ?? null,
                    guaranteedStopLoss: data.guaranteedStopLoss ?? null,
                    stopLossTriggerMethod: data.stopLossTriggerMethod ?? null,
                    trailingTakeProfitActivationDistance: data.trailingTakeProfitActivationDistance ?? null,
                    trailingTakeProfitDistance: data.trailingTakeProfitDistance ?? null,
                    breakEvenActivationDistance: data.breakEvenActivationDistance ?? null,
                    breakEvenOffsetDistance: data.breakEvenOffsetDistance ?? null,
                    trailingStopLossDistance: data.trailingStopLossDistance ?? null,
                    brokerOrderId: data.brokerOrderId === undefined || data.brokerOrderId === null
                        ? null
                        : String(data.brokerOrderId),
                    brokerPositionId: data.brokerPositionId === undefined || data.brokerPositionId === null
                        ? null
                        : String(data.brokerPositionId),
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
            await this.tradeAlertDb.createForTradeSignals(savedSignals, queryRunner);
            return entity;
        }
        catch (error) {
            throw error;
        }
    }
}
exports.TradeSignalDB = TradeSignalDB;
