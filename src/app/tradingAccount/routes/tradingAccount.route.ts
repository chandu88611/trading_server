// src/app/tradingAccount/routes/tradingAccount.route.ts
import { Router } from "express";
import { requireAuth, Roles } from "../../../middleware/auth";
import { TradingAccountController } from "../controllers/tradingAccount.controller";

export class TradingAccountRouter {
  private routes = Router();
  private controller = new TradingAccountController();

  constructor() {
    // List all accounts for current user
    this.routes.get(
      "/",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.listMyAccounts.bind(this.controller)
    );

    // Get specific account by ID
    this.routes.get(
      "/:id",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.getMyAccountById.bind(this.controller)
    );

    // Create new account
    this.routes.post(
      "/",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.createMyAccount.bind(this.controller)
    );

    // Update account
    this.routes.patch(
      "/:id",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.updateMyAccount.bind(this.controller)
    );

    // Delete account
    this.routes.delete(
      "/:id",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.deleteMyAccount.bind(this.controller)
    );
  }

  getRouter() {
    return this.routes;
  }
}
