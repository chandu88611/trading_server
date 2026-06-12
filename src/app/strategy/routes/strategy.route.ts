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

    this.router.get(
      "/",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.list.bind(controller)
    );

    this.router.post(
      "/",
      requireAuth([Roles.ADMIN]),
      controller.create.bind(controller)
    );

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

    this.router.patch(
      "/instance/:instanceId/volume",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.updateUserStrategyInstanceVolume.bind(controller)
    );

    this.router.post(
      "/:strategyId/subscribe",
      requireAuth([Roles.USER]),
      controller.subscribe.bind(controller)
    );

    this.router.get(
      "/:strategyId/my-performance",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.myPerformance.bind(controller)
    );

    // Admins toggle the global catalog; users toggle their own active instances by strategy id.
    this.router.patch(
      "/:strategyId/enable",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.enableStrategy.bind(controller)
    );

    this.router.patch(
      "/:strategyId/disable",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.disableStrategy.bind(controller)
    );

    this.router.patch(
      "/:strategyId",
      requireAuth([Roles.ADMIN]),
      controller.update.bind(controller)
    );

    this.router.delete(
      "/:strategyId",
      requireAuth([Roles.ADMIN]),
      controller.retire.bind(controller)
    );

    this.router.get(
      "/:strategyId",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.get.bind(controller)
    );
  }

  getRouter() {
    return this.router;
  }
}
