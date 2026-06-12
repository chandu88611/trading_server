import { Router } from "express";
import { PaymentController } from "../controller/payment.controller";
import { requireAuth, Roles } from "../../../middleware/auth";
import { razorpayRawBody } from "../../../middleware/razorpayRawBody";

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
      "/subscription/verify",
      requireAuth([Roles.USER]),
      ctrl.verifyPayment.bind(ctrl)
    );

    this.router.post(
      "/razorpay/webhook",
      razorpayRawBody,
      ctrl.webhook.bind(ctrl)
    );

    this.router.post(
      "/razorpayx/webhook",
      razorpayRawBody,
      ctrl.payoutWebhook.bind(ctrl)
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

    this.router.get(
      "/wallet",
      requireAuth([Roles.USER, Roles.ADMIN]),
      ctrl.getWallet.bind(ctrl)
    );

    this.router.get(
      "/withdrawals",
      requireAuth([Roles.USER, Roles.ADMIN]),
      ctrl.listWithdrawals.bind(ctrl)
    );

    this.router.post(
      "/withdrawals",
      requireAuth([Roles.USER, Roles.ADMIN]),
      ctrl.createWithdrawal.bind(ctrl)
    );

    this.router.get(
      "/admin/withdrawals",
      requireAuth([Roles.ADMIN]),
      ctrl.listAdminWithdrawals.bind(ctrl)
    );

    this.router.patch(
      "/admin/withdrawals/:withdrawalId/approve",
      requireAuth([Roles.ADMIN]),
      ctrl.approveWithdrawal.bind(ctrl)
    );

    this.router.patch(
      "/admin/withdrawals/:withdrawalId/reject",
      requireAuth([Roles.ADMIN]),
      ctrl.rejectWithdrawal.bind(ctrl)
    );

    this.router.put(
      "/admin/withdrawal-settings",
      requireAuth([Roles.ADMIN]),
      ctrl.updateWithdrawalSettings.bind(ctrl)
    );

    this.router.get("/invoices", requireAuth([Roles.USER]), ctrl.listMyInvoices.bind(ctrl));
  }

  getRouter() {
    return this.router;
  }
}
