"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentRouter = void 0;
const express_1 = require("express");
const payment_controller_1 = require("../controller/payment.controller");
const auth_1 = require("../../../middleware/auth");
const razorpayRawBody_1 = require("../../../middleware/razorpayRawBody");
class PaymentRouter {
    constructor() {
        this.router = (0, express_1.Router)();
        this.init();
    }
    init() {
        const ctrl = new payment_controller_1.PaymentController();
        this.router.post("/subscription/checkout", (0, auth_1.requireAuth)([auth_1.Roles.USER]), ctrl.createCheckout.bind(ctrl));
        this.router.post("/subscription/verify", (0, auth_1.requireAuth)([auth_1.Roles.USER]), ctrl.verifyPayment.bind(ctrl));
        this.router.post("/razorpay/webhook", razorpayRawBody_1.razorpayRawBody, ctrl.webhook.bind(ctrl));
        this.router.post("/razorpayx/webhook", razorpayRawBody_1.razorpayRawBody, ctrl.payoutWebhook.bind(ctrl));
        this.router.get("/subscription/current", (0, auth_1.requireAuth)([auth_1.Roles.USER]), ctrl.getCurrentSubscription.bind(ctrl));
        this.router.post("/subscription/cancel", (0, auth_1.requireAuth)([auth_1.Roles.USER]), ctrl.cancelSubscription.bind(ctrl));
        this.router.get("/wallet", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), ctrl.getWallet.bind(ctrl));
        this.router.get("/withdrawals", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), ctrl.listWithdrawals.bind(ctrl));
        this.router.post("/withdrawals", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), ctrl.createWithdrawal.bind(ctrl));
        this.router.get("/admin/withdrawals", (0, auth_1.requireAuth)([auth_1.Roles.ADMIN]), ctrl.listAdminWithdrawals.bind(ctrl));
        this.router.patch("/admin/withdrawals/:withdrawalId/approve", (0, auth_1.requireAuth)([auth_1.Roles.ADMIN]), ctrl.approveWithdrawal.bind(ctrl));
        this.router.patch("/admin/withdrawals/:withdrawalId/reject", (0, auth_1.requireAuth)([auth_1.Roles.ADMIN]), ctrl.rejectWithdrawal.bind(ctrl));
        this.router.put("/admin/withdrawal-settings", (0, auth_1.requireAuth)([auth_1.Roles.ADMIN]), ctrl.updateWithdrawalSettings.bind(ctrl));
        this.router.get("/invoices", (0, auth_1.requireAuth)([auth_1.Roles.USER]), ctrl.listMyInvoices.bind(ctrl));
    }
    getRouter() {
        return this.router;
    }
}
exports.PaymentRouter = PaymentRouter;
