"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertSnapshotService = void 0;
const data_source_1 = __importDefault(require("../../../../db/data-source"));
const constants_1 = require("../../../../types/constants");
const trade_identify_1 = require("../../../../types/trade-identify");
const copyTrading_service_1 = require("../../../copyTrading/services/copyTrading.service");
const cTrader_1 = require("../../../cTraderListener/services/cTrader");
const userSubscription_1 = require("../../../userSubscription/services/userSubscription");
const brokerCredential_service_1 = require("../../brokerCredentials/services/brokerCredential.service");
const brokerJob_service_1 = require("../../brokerJobs/services/brokerJob.service");
const tradeSignal_service_1 = require("../../brokerSignals/services/tradeSignal.service");
const alertSnapshot_db_1 = require("../db/alertSnapshot.db");
class AlertSnapshotService {
    constructor() {
        this.alertSnapshotDB = new alertSnapshot_db_1.AlertSnapshotDB();
        this.brokerJobService = new brokerJob_service_1.BrokerJobService();
        this.brokerCredentialService = new brokerCredential_service_1.BrokerCredentialService();
        this.tradeSignalService = new tradeSignal_service_1.TradeSignalService();
        this.userSubscriptionService = new userSubscription_1.UserSubscriptionService();
        this.copyTradingService = new copyTrading_service_1.CopyTradingService();
        this.cTraderService = new cTrader_1.CTraderService();
    }
    async create(payload) {
        const queryRunner = data_source_1.default.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            let credentialdata = await this.alertSnapshotDB.getAllTradeTypeForUser(payload.userId);
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
            let isValidPlan = await this.userSubscriptionService.subscriberPlanValidation(payload.userId, assetType);
            if (!isValidPlan) {
                throw {
                    status: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "invalid_subscription_plan",
                };
            }
            if (credentialdata.length > 0) {
                await this.attendAlertForForexTrader(credentialdata, payload, queryRunner);
            }
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
    async attendAlertForForexTrader(credentialdata, payload, queryRunner) {
        try {
            await this.alertSnapshotDB.createBrokerJobTradeAndStatus(credentialdata, payload, queryRunner);
        }
        catch (error) {
            throw error;
        }
    }
    async getAlertHistory(userId, q) {
        if (!userId) {
            throw { status: constants_1.HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
        }
        const page = Math.max(1, Number(q.page || 1));
        const limit = Math.min(200, Math.max(1, Number(q.limit || 20)));
        // resolve time window
        const { from, to } = this.resolveTimeWindow(q.from, q.to, q.lastMinutes);
        return this.alertSnapshotDB.getHistory({
            userId,
            page,
            limit,
            ticker: q.ticker,
            exchange: q.exchange,
            interval: q.interval,
            jobId: q.jobId,
            from,
            to,
        });
    }
    async getAlertTimeline(userId, q) {
        if (!userId) {
            throw { status: constants_1.HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
        }
        const { from, to } = this.resolveTimeWindow(q.from, q.to, q.lastMinutes);
        return this.alertSnapshotDB.getTimeline({
            userId,
            bucket: q.bucket || "15m",
            ticker: q.ticker,
            exchange: q.exchange,
            interval: q.interval,
            jobId: q.jobId,
            from,
            to,
        });
    }
    resolveTimeWindow(from, to, lastMinutes) {
        if (lastMinutes && lastMinutes > 0) {
            const end = new Date();
            const start = new Date(Date.now() - lastMinutes * 60 * 1000);
            return { from: start, to: end };
        }
        const end = to ? new Date(to) : new Date();
        const start = from ? new Date(from) : new Date(Date.now() - 60 * 60 * 1000); // default last 1 hour
        return { from: start, to: end };
    }
    async listByJob(jobId) {
        return this.alertSnapshotDB.listByJob(jobId);
    }
    async getOpenJobs(userId, q) {
        try {
            return this.alertSnapshotDB.getOpenJobs(userId, q);
        }
        catch (error) {
            throw error;
        }
    }
}
exports.AlertSnapshotService = AlertSnapshotService;
