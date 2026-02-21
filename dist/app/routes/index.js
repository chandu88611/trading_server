"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationRouter = void 0;
const express_1 = require("express");
const routes_1 = require("../user/routes");
const auth_route_1 = __importDefault(require("../auth/routes/auth.route"));
const brokerJob_route_1 = __importDefault(require("../broker/brokerJobs/routes/brokerJob.route"));
// import TradeSignalRouter from "../broker/brokerSignals/routes/tradeSignal.route";
const alertSnapshot_route_1 = __importDefault(require("../broker/brokerAlerts/routes/alertSnapshot.route"));
const subscriptionPlan_route_1 = require("../subscriptionPlan/routes/subscriptionPlan.route");
const payment_route_1 = require("../billing/routes/payment.route");
const userSubscription_route_1 = require("../userSubscription/routes/userSubscription.route");
// import { CopyTradingRouter } from "../copyTrading/routes/copyTrading.routes";
const tradingAccount_route_1 = require("../tradingAccount/routes/tradingAccount.route");
const mt5Listener_routes_1 = require("../mt5Listener/mt5Listener.routes");
const ctraderRoutes_1 = __importDefault(require("../ctrader/ctraderRoutes"));
const zebu_1 = require("../zebu/routes/zebu");
const trade_route_1 = require("../trade/routes/trade.route");
class ApplicationRouter {
    constructor() {
        this.applicationRoutes = (0, express_1.Router)();
        this.initApplicationRoutes();
    }
    initApplicationRoutes() {
        this.applicationRoutes.use("/user", new routes_1.UserRouter().getRouter());
        this.applicationRoutes.use("/auth", new auth_route_1.default().getRouter());
        this.applicationRoutes.use("/broker/jobs", brokerJob_route_1.default);
        // this.applicationRoutes.use("/broker/signals", TradeSignalRouter);
        this.applicationRoutes.use("/tradingview/alerts", alertSnapshot_route_1.default);
        this.applicationRoutes.use("/admin/plans", new subscriptionPlan_route_1.SubscriptionPlanRouter().getRouter());
        this.applicationRoutes.use("/billing", new payment_route_1.PaymentRouter().getRouter());
        this.applicationRoutes.use("/", new userSubscription_route_1.UserSubscriptionRouter().getRouter());
        this.applicationRoutes.use("/trading-accounts", new tradingAccount_route_1.TradingAccountRouter().getRouter());
        // this.applicationRoutes.use(
        //   "/copy-trade",
        //   new CopyTradingRouter().getRouter()
        // );
        this.applicationRoutes.use("/signal", new mt5Listener_routes_1.Mt5ListenerRouter().getRouter());
        this.applicationRoutes.use("/ctrader", ctraderRoutes_1.default);
        this.applicationRoutes.use("/zebu", new zebu_1.ZebuRouter().getRouter());
        this.applicationRoutes.use("/trade", new trade_route_1.TradeRouter().getRouter());
    }
    getRouter() {
        return this.applicationRoutes;
    }
}
exports.ApplicationRouter = ApplicationRouter;
