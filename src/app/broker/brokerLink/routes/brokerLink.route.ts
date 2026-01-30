// src/app/broker/routes/brokerLink.route.ts
import { Router } from "express";
import { requireAuth, Roles } from "../../../../middleware/auth";
import { BrokerLinkController } from "../controllers/brokerLink.controller";

export class BrokerLinkRouter {
  private routes = Router({ mergeParams: true });
  private controller = new BrokerLinkController();

  constructor() {
    // List all brokers linked to a trading account
    this.routes.get(
      "/:accountId",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.listBrokersForAccount.bind(this.controller)
    );

    // Link a broker to a trading account
    this.routes.post(
      "/:accountId",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.linkBrokerToAccount.bind(this.controller)
    );

    // Unlink a broker from a trading account
    this.routes.delete(
      "/:brokerId",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.unlinkBrokerFromAccount.bind(this.controller)
    );
  }

  getRouter() {
    return this.routes;
  }
}
