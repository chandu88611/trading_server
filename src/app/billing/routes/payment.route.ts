import { Router } from "express";
import { PaymentController } from "../controller/payment.controller";
import { requireAuth, Roles } from "../../../middleware/auth";
import { stripeRawBody } from "../../../middleware/stripeRawBody";

export class PaymentRouter {
  private router: Router;

  constructor() {
    this.router = Router();
    this.init();
  }

  init() {
    const ctrl = new PaymentController();

    this.router.post(
      "/subscription/checkout",
      requireAuth([Roles.USER]),
      ctrl.createCheckout.bind(ctrl)
    );

    this.router.post(
      "/stripe/webhook",
      stripeRawBody,           
      ctrl.webhook.bind(ctrl)
    );

      this.router.get(
    "/subscription/current",
    requireAuth([Roles.USER]),
    ctrl.getCurrentSubscription.bind(ctrl)
  );

  this.router.post(
    "/subscription/cancel",
    requireAuth([Roles.USER]),
    ctrl.cancelSubscription.bind(ctrl)
  );
  }

  getRouter() {
    return this.router;
  }
}
