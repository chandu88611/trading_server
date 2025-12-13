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
  }

  getRouter() {
    return this.router;
  }
}
