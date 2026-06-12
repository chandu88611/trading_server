// src/app/trade/routes/trade.route.ts
import { Router } from "express";
import { requireAuth, Roles } from "../../../middleware/auth";
import { TradeController } from "../controllers/trade.controller";

export class TradeRouter {
  private routes = Router();
  private controller = new TradeController();

  constructor() {
    this.routes.get(
      "/admin/strategy-trades",
      requireAuth([Roles.ADMIN]),
      this.controller.listAdminStrategyTrades.bind(this.controller)
    );

    this.routes.get(
      "/admin/strategy-trades/:adminStrategyTradeId",
      requireAuth([Roles.ADMIN]),
      this.controller.getAdminStrategyTrade.bind(this.controller)
    );

    this.routes.post(
      "/admin/strategy-trades/:adminStrategyTradeId/close",
      requireAuth([Roles.ADMIN]),
      this.controller.closeAdminStrategyTrade.bind(this.controller)
    );

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

    this.routes.get(
      "/pnl",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.getMyPnl.bind(this.controller)
    );

    this.routes.get(
      "/alerts",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.listTradeAlerts.bind(this.controller)
    );

    this.routes.patch(
      "/alerts/read-all",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.markAllTradeAlertsRead.bind(this.controller)
    );

    this.routes.patch(
      "/alerts/:alertId/read",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.markTradeAlertRead.bind(this.controller)
    );

    this.routes.post(
      "/close",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.closeTrade.bind(this.controller)
    )
  }

  getRouter() {
    return this.routes;
  }
}
