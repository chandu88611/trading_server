"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationRouter = void 0;
const express_1 = require("express");
const routes_1 = require("../user/routes");
const auth_route_1 = __importDefault(require("../auth/routes/auth.route"));
const brokerCredential_route_1 = __importDefault(require("../broker/brokerCredentials/routes/brokerCredential.route"));
const brokerSession_route_1 = __importDefault(require("../broker/brokerSessions/routes/brokerSession.route"));
const brokerJob_route_1 = __importDefault(require("../broker/brokerJobs/routes/brokerJob.route"));
const brokerEvent_route_1 = __importDefault(require("../broker/brokerEvents/routes/brokerEvent.route"));
const tradeSignal_route_1 = __importDefault(require("../broker/brokerSignals/routes/tradeSignal.route"));
const alertSnapshot_route_1 = __importDefault(require("../broker/brokerAlerts/routes/alertSnapshot.route"));
const subscriptionPlan_route_1 = require("../subscriptionPlan/routes/subscriptionPlan.route");
const payment_route_1 = require("../billing/routes/payment.route");
const userSubscription_route_1 = require("../userSubscription/routes/userSubscription.route");
const copyTrading_routes_1 = require("../copyTrading/routes/copyTrading.routes");
const forexTraderUserDetails_routes_1 = require("../ForexCopy/routes/forexTraderUserDetails.routes");
const tradingAccount_route_1 = require("../tradingAccount/routes/tradingAccount.route");
const mt5Listener_routes_1 = require("../mt5Listener/mt5Listener.routes");
class ApplicationRouter {
    constructor() {
        this.applicationRoutes = (0, express_1.Router)();
        this.initApplicationRoutes();
    }
    initApplicationRoutes() {
        this.applicationRoutes.use("/user", new routes_1.UserRouter().getRouter());
        this.applicationRoutes.use("/auth", new auth_route_1.default().getRouter());
        this.applicationRoutes.use("/broker/credentials", brokerCredential_route_1.default);
        this.applicationRoutes.use("/broker/sessions", brokerSession_route_1.default);
        this.applicationRoutes.use("/broker/jobs", brokerJob_route_1.default);
        this.applicationRoutes.use("/broker/events", brokerEvent_route_1.default);
        this.applicationRoutes.use("/broker/signals", tradeSignal_route_1.default);
        this.applicationRoutes.use("/tradingview/alerts", alertSnapshot_route_1.default);
        this.applicationRoutes.use("/admin/plans", new subscriptionPlan_route_1.SubscriptionPlanRouter().getRouter());
        this.applicationRoutes.use("/billing", new payment_route_1.PaymentRouter().getRouter());
        this.applicationRoutes.use("/", new userSubscription_route_1.UserSubscriptionRouter().getRouter());
        this.applicationRoutes.use("/trading-accounts", new tradingAccount_route_1.TradingAccountRouter().getRouter());
        this.applicationRoutes.use("/copy-trade", new copyTrading_routes_1.CopyTradingRouter().getRouter());
        this.applicationRoutes.use("/forex-trader-user-details", new forexTraderUserDetails_routes_1.ForexTraderUserDetailsRouter().getRouter());
        this.applicationRoutes.use("/signal", new mt5Listener_routes_1.Mt5ListenerRouter().getRouter());
    }
    getRouter() {
        return this.applicationRoutes;
    }
}
exports.ApplicationRouter = ApplicationRouter;
