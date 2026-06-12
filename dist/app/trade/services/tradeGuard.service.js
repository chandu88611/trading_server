"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeGuardService = void 0;
// src/app/trade/services/tradeGuard.service.ts
const data_source_1 = __importDefault(require("../../../db/data-source"));
const trade_identify_1 = require("../../../types/trade-identify");
const userSubscription_db_1 = require("../../userSubscription/services/userSubscription.db");
const constants_1 = require("../../../types/constants");
const entity_1 = require("../../../entity");
class TradeGuardService {
    constructor() {
        this.userRepo = data_source_1.default.getRepository(entity_1.User);
        this.subDB = new userSubscription_db_1.UserSubscriptionDBService();
    }
    resolveMarketType(assetType) {
        switch (assetType) {
            case trade_identify_1.AssetType.FOREX:
                return trade_identify_1.MarketType.FOREX;
            case trade_identify_1.AssetType.CRYPTO:
                return trade_identify_1.MarketType.CRYPTO;
            case trade_identify_1.AssetType.STOCK:
            case trade_identify_1.AssetType.INDEX:
            case trade_identify_1.AssetType.COMMODITY:
            case trade_identify_1.AssetType.FUTURES:
                return trade_identify_1.MarketType.INDIAN;
            default:
                return null;
        }
    }
    async checkTradeAllowed(input) {
        try {
            const { userId, symbol, exchange } = input;
            // 1) user + allowTrade
            const user = await this.userRepo.findOne({ where: { id: userId } });
            if (!user) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "user_not_found",
                };
            }
            if (!user.allowTrade) {
                return { allowed: false, reason: "trade_not_allowed_for_user" };
            }
            // 2) detect asset type from symbol
            const assetType = trade_identify_1.AssetClassifier.detect({ symbol, exchange });
            if (assetType === trade_identify_1.AssetType.UNKNOWN) {
                return { allowed: false, reason: "unknown_asset_type" };
            }
            const marketType = this.resolveMarketType(assetType);
            if (!marketType) {
                return { allowed: false, reason: "unsupported_market_type" };
            }
            // 3) active subscription for this market?
            const sub = await this.subDB.subscriberPlanValidation(userId, marketType);
            if (!sub) {
                return {
                    allowed: false,
                    reason: "no_active_subscription_for_market",
                };
            }
            // 4) (optional) later: pull PlanLimits and enforce:
            //    - maxConnectedAccounts
            //    - maxTradesPerWeek
            //    - maxDailyTrade
            //    - maxLotPerTrade
            // For now we just say YES if subscription exists.
            return {
                allowed: true,
                subscriptionId: sub.id,
            };
        }
        catch (error) {
            if (error instanceof Object && 'statusCode' in error) {
                throw error;
            }
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "failed_to_check_trade_allowed",
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
}
exports.TradeGuardService = TradeGuardService;
