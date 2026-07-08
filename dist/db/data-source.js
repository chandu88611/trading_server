"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
exports.ensureAppDataSourceInitialized = ensureAppDataSourceInitialized;
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const dotenv_1 = __importDefault(require("dotenv"));
const entity_1 = require("../entity");
const AlertSnapshots_1 = require("../entity/AlertSnapshots");
const TradeSignals_1 = require("../entity/TradeSignals");
const UserBillingDetails_1 = require("../entity/UserBillingDetails");
const CopyTradingFollow_1 = require("../entity/CopyTradingFollow");
const CopyTradingMaster_1 = require("../entity/CopyTradingMaster");
const UserTradingAccount_1 = require("../entity/UserTradingAccount");
const Strategy_1 = require("../entity/Strategy");
const PlanType_1 = require("../entity/PlanType");
const Market_1 = require("../entity/Market");
const PlanPricing_1 = require("../entity/PlanPricing");
const PlanLimits_1 = require("../entity/PlanLimits");
const PlanFeature_1 = require("../entity/PlanFeature");
const PlanBundleItem_1 = require("../entity/PlanBundleItem");
const PlanStrategy_1 = require("../entity/PlanStrategy");
const TradeSignalsStatus_1 = require("../entity/TradeSignalsStatus");
const Brokers_1 = require("../entity/Brokers");
const CTraderSession_1 = require("../entity/CTraderSession");
const CTraderSymbol_1 = require("../entity/CTraderSymbol");
const UserStrategyInstance_1 = require("../entity/UserStrategyInstance");
dotenv_1.default.config();
const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5449;
exports.AppDataSource = new typeorm_1.DataSource({
    type: "postgres",
    host: process.env.DB_HOST || "localhost",
    port,
    username: process.env.DB_USER || "kite",
    password: process.env.DB_PASSWORD || "kitepass",
    database: process.env.DB_NAME || "kite",
    synchronize: false,
    logging: false,
    entities: [
        entity_1.User,
        entity_1.AuthProvider,
        entity_1.RefreshToken,
        AlertSnapshots_1.AlertSnapshot,
        entity_1.SubscriptionInvoice,
        entity_1.SubscriptionPayment,
        entity_1.RazorpayOrder,
        entity_1.SubscriptionPlan,
        entity_1.PlanAdminWebhookToken,
        TradeSignals_1.TradeSignal,
        entity_1.UserSubscription,
        entity_1.UserEdgingStatus,
        entity_1.UserRiskLimits,
        entity_1.ReferralRewardCredit,
        entity_1.WithdrawalRequest,
        entity_1.WithdrawalSetting,
        entity_1.AdminStrategyTradeScheduleSetting,
        entity_1.AdminStrategyTrade,
        entity_1.CrmSyncOutbox,
        entity_1.SupportTicket,
        entity_1.SupportTicketMessage,
        entity_1.CTraderTrailingTakeProfitMonitor,
        entity_1.SubscriberTradeAlert,
        UserBillingDetails_1.UserBillingDetails,
        UserTradingAccount_1.UserTradingAccount,
        CopyTradingFollow_1.CopyTradingFollowers,
        CopyTradingMaster_1.CopyTradingMaster,
        Strategy_1.Strategy,
        TradeSignalsStatus_1.TradeSignalStatus,
        PlanType_1.PlanType,
        Market_1.Market,
        PlanPricing_1.PlanPricing,
        PlanLimits_1.PlanLimits,
        PlanFeature_1.PlanFeature,
        PlanBundleItem_1.PlanBundleItem,
        PlanStrategy_1.PlanStrategy,
        UserStrategyInstance_1.UserStrategyInstance,
        Brokers_1.Broker,
        CTraderSession_1.CTraderSession,
        CTraderSymbol_1.CTraderSymbol,
        entity_1.Mt5Symbol,
        entity_1.ZebuProtectionMonitor,
        entity_1.BrokerInstrument,
    ],
    migrations: [],
    subscribers: [],
});
let initializePromise = null;
async function ensureAppDataSourceInitialized() {
    if (exports.AppDataSource.isInitialized) {
        return exports.AppDataSource;
    }
    if (!initializePromise) {
        initializePromise = exports.AppDataSource.initialize().catch((error) => {
            initializePromise = null;
            throw error;
        });
    }
    return initializePromise;
}
exports.default = exports.AppDataSource;
