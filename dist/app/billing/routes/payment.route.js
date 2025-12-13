"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentRouter = void 0;
const express_1 = require("express");
const payment_controller_1 = require("../controller/payment.controller");
const auth_1 = require("../../../middleware/auth");
const stripeRawBody_1 = require("../../../middleware/stripeRawBody");
class PaymentRouter {
    constructor() {
        this.router = (0, express_1.Router)();
        this.init();
    }
    init() {
        const ctrl = new payment_controller_1.PaymentController();
        this.router.post("/subscription/checkout", (0, auth_1.requireAuth)([auth_1.Roles.USER]), ctrl.createCheckout.bind(ctrl));
        this.router.post("/stripe/webhook", stripeRawBody_1.stripeRawBody, ctrl.webhook.bind(ctrl));
    }
    getRouter() {
        return this.router;
    }
}
exports.PaymentRouter = PaymentRouter;
