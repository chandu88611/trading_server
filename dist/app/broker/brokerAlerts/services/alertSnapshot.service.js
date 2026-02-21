"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertSnapshotService = void 0;
const data_source_1 = __importDefault(require("../../../../db/data-source"));
const constants_1 = require("../../../../types/constants");
const trade_identify_1 = require("../../../../types/trade-identify");
// import { CopyTradingService } from "../../../copyTrading/services/copyTrading.service";
// import { CTraderService } from "../../../cTraderListener/services/cTrader";
const userSubscription_1 = require("../../../userSubscription/services/userSubscription");
const tradeSignal_service_1 = require("../../brokerSignals/services/tradeSignal.service");
const alertSnapshot_db_1 = require("./alertSnapshot.db");
const tradingAccount_service_1 = require("../../../tradingAccount/services/tradingAccount.service");
class AlertSnapshotService {
    constructor() {
        this.alertSnapshotDB = new alertSnapshot_db_1.AlertSnapshotDB();
        this.tradeSignalService = new tradeSignal_service_1.TradeSignalService();
        this.userSubscriptionService = new userSubscription_1.UserSubscriptionService();
        // this.copyTradingService = new CopyTradingService();
        // this.cTraderService = new CTraderService();
        this.tradingAccountService = new tradingAccount_service_1.TradingAccountService();
    }
    async create(payload) {
        const queryRunner = data_source_1.default.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            let assetType = await this.isValidAssetType(payload);
            let isValidPlan = await this.userSubscriptionService.subscriberPlanValidation(payload.userId, payload.market);
            if (!isValidPlan) {
                throw {
                    status: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "invalid_subscription_plan",
                };
            }
            let snapshot = await this.alertSnapshotDB.create(payload, queryRunner);
            let brokerData = await this.alertSnapshotDB.getBrokerId(payload.market);
            let userTradingAccounts = await this.tradingAccountService.getAllCopyTradingAccounts(payload.userId, brokerData);
            let tradeSignalPayload = [];
            if (userTradingAccounts.length > 0) {
                console.log("Creating trade signals for user", userTradingAccounts);
                tradeSignalPayload = userTradingAccounts.map(account => ({
                    userId: account.userId,
                    tradingAccountId: account.id,
                    alertSnapshotsId: snapshot.id,
                    action: payload.action,
                    symbol: payload.ticker,
                    price: payload.close,
                    exchange: payload.exchange,
                    signalTime: payload.alertTime,
                    volume: payload.volume,
                    assetType: assetType,
                }));
            }
            await this.tradeSignalService.createTradeSignal(tradeSignalPayload, queryRunner);
            await queryRunner.commitTransaction();
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async isValidAssetType(payload) {
        try {
            let assetType = trade_identify_1.AssetClassifier.detect({
                symbol: payload.ticker,
                exchange: payload.exchange,
            });
            if (assetType === trade_identify_1.AssetType.UNKNOWN) {
                throw {
                    status: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "unsupported_asset_type",
                };
            }
            return assetType;
        }
        catch (error) {
            throw error;
        }
    }
    async getAlertHistory(userId, query) {
        try {
            const data = await this.alertSnapshotDB.getAlertHistory(userId, query);
            return data;
        }
        catch (error) {
            throw error;
        }
    }
}
exports.AlertSnapshotService = AlertSnapshotService;
