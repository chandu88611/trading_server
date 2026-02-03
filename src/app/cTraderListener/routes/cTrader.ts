import { Router } from "express";
import { requireAuth, Roles } from "../../../middleware/auth";
import { CTraderController } from "../controller/cTrader";

export class CTraderRoutes {
  private router: Router;

  constructor() {
    this.router = Router();
    this.initRoutes();
  }

  initRoutes() {
    const controller = new CTraderController();

    this.router.post(
      "/oauth/exchange",
      controller.generateTokens.bind(controller)
    );
    this.router.get(
      "/callback",
      controller.oauthCallback.bind(controller)
    );

  }

  getRouter() {
    return this.router;
  }
}
