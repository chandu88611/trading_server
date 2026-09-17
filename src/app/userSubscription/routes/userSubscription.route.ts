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

    this.router.post("/subscription/activate-free", requireAuth([Roles.USER]), controller.subscribe.bind(controller));
    this.router.patch("/admin/subscription/:id/status", requireAuth([Roles.ADMIN]), controller.adminMutation.bind(controller));
    this.router.patch("/admin/subscription/:id/execution", requireAuth([Roles.ADMIN]), controller.adminMutation.bind(controller));
    this.router.post("/admin/subscription/:id/regenerate-token", requireAuth([Roles.ADMIN]), controller.adminMutation.bind(controller));

    this.router.post("/api/v1/subscription/dev-sandbox-activate", requireAuth([Roles.USER]), controller.activateDevSandbox.bind(controller));

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
