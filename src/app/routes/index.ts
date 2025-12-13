import { Router } from "express";
import { UserRouter } from "../user/routes";
import AuthRouter from "../auth/routes/auth.route";

import BrokerCredentialRouter from "../broker/brokerCredentials/routes/brokerCredential.route";
import BrokerSessionRouter from "../broker/brokerSessions/routes/brokerSession.route";
import BrokerJobRouter from "../broker/brokerJobs/routes/brokerJob.route";
import BrokerEventRouter from "../broker/brokerEvents/routes/brokerEvent.route";
import TradeSignalRouter from "../broker/brokerSignals/routes/tradeSignal.route";
import AlertSnapshotRouter from "../broker/brokerAlerts/routes/alertSnapshot.route";
import { SubscriptionPlanRouter } from "../subscriptionPlan/routes/subscriptionPlan.route";

export class ApplicationRouter {
  private applicationRoutes: Router;

  constructor() {
    this.applicationRoutes = Router();
    this.initApplicationRoutes();
  }

  initApplicationRoutes() {
    this.applicationRoutes.use("/user", new UserRouter().getRouter());
    this.applicationRoutes.use("/auth", new AuthRouter().getRouter());
    this.applicationRoutes.use("/broker/credentials", BrokerCredentialRouter);
    this.applicationRoutes.use("/broker/sessions", BrokerSessionRouter);
    this.applicationRoutes.use("/broker/jobs", BrokerJobRouter);
    this.applicationRoutes.use("/broker/events", BrokerEventRouter);
    this.applicationRoutes.use("/broker/signals", TradeSignalRouter);
    this.applicationRoutes.use("/broker/alerts", AlertSnapshotRouter);
    this.applicationRoutes.use("/admin/plans", new SubscriptionPlanRouter().getRouter());

  }

  getRouter() {
    return this.applicationRoutes;
  }
}
