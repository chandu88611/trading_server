// src/app/trade/routes/trade.route.ts
import { Router } from "express";
import { requireAuth, Roles } from "../../../middleware/auth";
import { TradeController } from "../controllers/trade.controller";

export class TradeRouter {
  private routes = Router();
  private controller = new TradeController();

  constructor() {
    // Create a new trade
    this.routes.post(
      "/",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.create.bind(this.controller)
    );

    // TODO: Add endpoints for:
    // GET /trades - list user trades with pagination and filters
    // GET /trades/:id - get trade details
    // GET /trades/history - get trade history with stats
  }

  getRouter() {
    return this.routes;
  }
}
