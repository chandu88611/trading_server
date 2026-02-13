"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const dotenv_1 = __importDefault(require("dotenv"));
const entity_1 = require("../entity");
const AlertSnapshots_1 = require("../entity/AlertSnapshots");
const TradeSignals_1 = require("../entity/TradeSignals");
const UserBillingDetails_1 = require("../entity/UserBillingDetails");
const CopyMasterEvent_1 = require("../entity/CopyMasterEvent");
const CopyTradeTask_1 = require("../entity/CopyTradeTask");
const CopyTradingFollow_1 = require("../entity/CopyTradingFollow");
const CopyTradingMaster_1 = require("../entity/CopyTradingMaster");
const UserTradingAccount_1 = require("../entity/UserTradingAccount");
const Strategy_1 = require("../entity/Strategy");
const ForexTraderUserDetails_1 = require("../entity/ForexTraderUserDetails");
const PlanType_1 = require("../entity/PlanType");
const Market_1 = require("../entity/Market");
const PlanPricing_1 = require("../entity/PlanPricing");
const PlanLimits_1 = require("../entity/PlanLimits");
const PlanFeature_1 = require("../entity/PlanFeature");
const PlanBundleItem_1 = require("../entity/PlanBundleItem");
const PlanStrategy_1 = require("../entity/PlanStrategy");
const CTradeSignals_1 = require("../entity/CTradeSignals");
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
        entity_1.BrokerCredential,
        entity_1.BrokerSession,
        entity_1.BrokerJob,
        entity_1.BrokerEvent,
        entity_1.RefreshToken,
        AlertSnapshots_1.AlertSnapshot,
        entity_1.SubscriptionInvoice,
        entity_1.SubscriptionPayment,
        entity_1.SubscriptionPlan,
        TradeSignals_1.TradeSignal,
        entity_1.UserSubscription,
        UserBillingDetails_1.UserBillingDetails,
        UserTradingAccount_1.UserTradingAccount,
        CopyMasterEvent_1.CopyMasterEvent,
        CopyTradeTask_1.CopyTradeTask,
        CopyTradingFollow_1.CopyTradingFollow,
        CopyTradingMaster_1.CopyTradingMaster,
        Strategy_1.Strategy,
        ForexTraderUserDetails_1.ForexTraderUserDetails,
        PlanType_1.PlanType,
        Market_1.Market,
        PlanPricing_1.PlanPricing,
        PlanLimits_1.PlanLimits,
        PlanFeature_1.PlanFeature,
        PlanBundleItem_1.PlanBundleItem,
        PlanStrategy_1.PlanStrategy,
        CTradeSignals_1.CTradeSignal,
        CTradeSignals_1.CTradeSignalStatus
    ],
    migrations: [],
    subscribers: [],
});
exports.default = exports.AppDataSource;
