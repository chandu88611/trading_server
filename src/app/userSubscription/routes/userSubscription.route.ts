import { Router } from "express";
import { UserSubscriptionController } from "../controller/userSubscription.controller";
import { requireAuth, Roles } from "../../../middleware/auth";

export class UserSubscriptionRouter {
  private router: Router;

  constructor() {
    this.router = Router();
    this.initRoutes();
  }

  initRoutes() {
    const controller = new UserSubscriptionController();

    // ---- User routes ----
    this.router.post(
      "/subscription/subscribe",
      requireAuth([Roles.USER]),
      controller.subscribe.bind(controller)
    );

    this.router.post(
      "/subscription/cancel",
      requireAuth([Roles.USER]),
      controller.cancel.bind(controller)
    );

    this.router.get(
      "/subscription/current",
      requireAuth([Roles.USER]),
      controller.current.bind(controller)
    );

    this.router.get(
      "/subscription/follower-user-trading-account",
      requireAuth([Roles.USER]),
      controller.followerUserTradingAccount.bind(controller)
    );

    this.router.get(
      "/admin/subscription/user/:userId",
      requireAuth([Roles.ADMIN]),
      controller.getUserSubscriptions.bind(controller)
    );

    this.router.get(
      "/admin/subscription/all",
      requireAuth([Roles.ADMIN]),
      controller.adminGetAll.bind(controller)
    );

    this.router.post(
      "/admin/subscription/update-webhook",
      requireAuth([Roles.ADMIN]),
      controller.updateWebhookStatus.bind(controller)
    );

    this.router.patch("/subscription/strategy-selections", requireAuth([Roles.USER]), controller.saveStrategySelections.bind(controller));

    this.router.patch(
      "/subscription/webhook-settings",
      requireAuth([Roles.USER]),
      controller.saveWebhookSettings.bind(controller)
    );
  }

  getRouter() {
    return this.router;
  }
}
