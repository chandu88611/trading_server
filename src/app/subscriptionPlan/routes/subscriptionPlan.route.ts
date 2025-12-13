// src/app/subscriptionPlan/routes/subscriptionPlan.routes.ts
import { Router } from "express";
import { SubscriptionPlanController } from "../controller/subscriptionPlan.controller";
import { requireAuth, Roles } from "../../../middleware/auth";

export class SubscriptionPlanRouter {
  private router: Router;

  constructor() {
    this.router = Router();
    this.init();
  }

  init() {
    const controller = new SubscriptionPlanController();

    // ✅ IMPORTANT: "all" must come BEFORE ":planId"
    this.router.get(
      "/subscription-plan/all",
      // requireAuth([Roles.ADMIN]),
      controller.getAll.bind(controller)
    );

    this.router.post(
      "/subscription-plan",
      // requireAuth([Roles.ADMIN]),
      controller.createPlan.bind(controller)
    );

    this.router.patch(
      "/subscription-plan/:planId",
      // requireAuth([Roles.ADMIN]),
      controller.updatePlan.bind(controller)
    );

    this.router.delete(
      "/subscription-plan/:planId",
      // requireAuth([Roles.ADMIN]),
      controller.deletePlan.bind(controller)
    );

    this.router.get(
      "/subscription-plan/:planId",
      // requireAuth([Roles.ADMIN]),
      controller.getPlan.bind(controller)
    );

    this.router.get("/subscription-plan/list", controller.getActive.bind(controller));
  }

  getRouter() {
    return this.router;
  }
}
