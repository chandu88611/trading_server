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
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.subscribe.bind(controller)
    );

    this.router.post(
      "/subscription/cancel",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.cancel.bind(controller)
    );

    this.router.get(
      "/subscription/current",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.current.bind(controller)
    );

    this.router.get(
      "/subscription/follower-user-trading-account",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.followerUserTradingAccount.bind(controller)
    );

    this.router.get(
      "/admin/subscription/user/:userId",
      requireAuth([Roles.ADMIN, Roles.USER]),
      controller.getUserSubscriptions.bind(controller)
    );

    this.router.get(
      "/admin/subscription/all",
      requireAuth([Roles.ADMIN, Roles.USER]),
      controller.adminGetAll.bind(controller)
    );

    this.router.post(
      "/admin/subscription/update-webhook",
      requireAuth([Roles.ADMIN, Roles.USER]),
      controller.updateWebhookStatus.bind(controller)
    );
  }

  getRouter() {
    return this.router;
  }
}
