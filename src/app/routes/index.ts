import { Router } from "express";
import { UserRouter } from "../user/routes";
import AuthRouter from "../auth/routes/auth.route";

import BrokerJobRouter from "../broker/brokerJobs/routes/brokerJob.route";
// import TradeSignalRouter from "../broker/brokerSignals/routes/tradeSignal.route";
import AlertSnapshotRouter from "../broker/brokerAlerts/routes/alertSnapshot.route";
import { SubscriptionPlanRouter } from "../subscriptionPlan/routes/subscriptionPlan.route";
import { PaymentRouter } from "../billing/routes/payment.route";
import { UserSubscriptionRouter } from "../userSubscription/routes/userSubscription.route";
import { CopyTradingRouter } from "../copyTrading/routes/copyTrading.routes";
import { TradingAccountRouter } from "../tradingAccount/routes/tradingAccount.route";
import { Mt5ListenerRouter } from "../mt5Listener/mt5Listener.routes";
import ctraderRouter from "../ctrader/ctraderRoutes";
import { ZebuRouter } from "../zebu/routes/zebu";
import { DhanRouter } from "../dhan/routes/dhan";
import { CoinDCXRouter } from "../coindcx/routes/coindcx";
import { TradeRouter } from "../trade/routes/trade.route";
import { StrategyRouter } from "../strategy/routes/strategy.route";
import { SupportTicketRouter } from "../support/routes/supportTicket.route";
import indiaRouter from "../india/india.routes";
import analyticsRouter from "./analytics.routes";
import adminRouter from "../admin/admin.routes";
import copyExecutionRouter from "../copyExecution/copyExecution.routes";

export class ApplicationRouter {
  private applicationRoutes: Router;

  constructor() {
    this.applicationRoutes = Router();
    this.initApplicationRoutes();
  }

  initApplicationRoutes() {
    const supportTicketRouter = new SupportTicketRouter();
    this.applicationRoutes.use("/user", new UserRouter().getRouter());
    this.applicationRoutes.use("/auth", new AuthRouter().getRouter());
    this.applicationRoutes.use("/broker/jobs", BrokerJobRouter);
    // this.applicationRoutes.use("/broker/signals", TradeSignalRouter);
    this.applicationRoutes.use("/tradingview/alerts", AlertSnapshotRouter);
    this.applicationRoutes.use(
      "/admin/plans",
      new SubscriptionPlanRouter().getRouter()
    );
    this.applicationRoutes.use("/billing", new PaymentRouter().getRouter());
    this.applicationRoutes.use("/", new UserSubscriptionRouter().getRouter());
    this.applicationRoutes.use("/trading-accounts", new TradingAccountRouter().getRouter());
    this.applicationRoutes.use(
      "/copy-trade",
      new CopyTradingRouter().getRouter()
    );
    this.applicationRoutes.use("/copy", copyExecutionRouter);
    

    this.applicationRoutes.use("/signal", new Mt5ListenerRouter().getRouter());
    this.applicationRoutes.use("/ctrader", ctraderRouter);
    this.applicationRoutes.use("/india", indiaRouter);
    this.applicationRoutes.use("/zebu", new ZebuRouter().getRouter());
    this.applicationRoutes.use("/dhan", new DhanRouter().getRouter());
    this.applicationRoutes.use("/coindcx", new CoinDCXRouter().getRouter());
    this.applicationRoutes.use("/trade",new TradeRouter().getRouter());
    this.applicationRoutes.use("/strategy", new StrategyRouter().getRouter());
    this.applicationRoutes.use("/support", supportTicketRouter.getUserRouter());
    this.applicationRoutes.use(
      "/integrations/crm/support",
      supportTicketRouter.getIntegrationRouter()
    );
    this.applicationRoutes.use("/admin/analytics", analyticsRouter);
    this.applicationRoutes.use("/admin", adminRouter);

  }

  getRouter() {
    return this.applicationRoutes;
  }
}
