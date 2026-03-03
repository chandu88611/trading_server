import { Router } from "express";
import { StrategyController } from "../strategy.controller";
import { requireAuth, Roles } from "../../../middleware/auth";

export class StrategyRouter {
  private router: Router;

  constructor() {
    this.router = Router();
    this.init();
  }

  private init() {
    const controller = new StrategyController();

    // User-level toggle for subscribed/instantiated strategies
    this.router.patch(
      "/instance/:instanceId/enable",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.enableUserStrategyInstance.bind(controller)
    );

    this.router.patch(
      "/instance/:instanceId/disable",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.disableUserStrategyInstance.bind(controller)
    );

    // Admin/global strategy catalogue toggle
    this.router.patch(
      "/:strategyId/enable",
      requireAuth([Roles.ADMIN]),
      controller.enableStrategy.bind(controller)
    );

    this.router.patch(
      "/:strategyId/disable",
      requireAuth([Roles.ADMIN]),
      controller.disableStrategy.bind(controller)
    );
  }

  getRouter() {
    return this.router;
  }
}

