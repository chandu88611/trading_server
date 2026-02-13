// src/app/trade/routes/trade.route.ts
import { Router } from "express";
import { requireAuth, Roles } from "../../../middleware/auth";
import { TradeController } from "../controllers/trade.controller";

export class TradeRouter {
  private routes = Router();
  private controller = new TradeController();

  constructor() {
    this.routes.get(
      "/all",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.getAllTrades.bind(this.controller)
    );

    this.routes.get(
      "/",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.getSingleTrade.bind(this.controller)
    );

    this.routes.get(
      "/history",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.getTradeHistory.bind(this.controller)
    );
  }

  getRouter() {
    return this.routes;
  }
}
