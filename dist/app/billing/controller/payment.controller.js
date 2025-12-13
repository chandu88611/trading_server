"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentController = void 0;
const stripe_service_1 = require("../services/stripe.service");
const billing_db_1 = require("../services/billing.db");
const error_handler_1 = require("../../../types/error-handler");
const stripeService = new stripe_service_1.StripeService();
const billingDb = new billing_db_1.BillingDBService();
class PaymentController {
    async createCheckout(req, res) {
        const userId = req.auth?.id;
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const { planId } = req.body;
        if (!planId)
            return res.status(400).json({ message: "planId required" });
        // fetch plan from DB
        const planRepo = (await Promise.resolve().then(() => __importStar(require("../../../db/data-source")))).default.getRepository("SubscriptionPlan");
        const plan = (await planRepo.findOne({
            where: { id: planId },
        }));
        if (!plan)
            return res.status(404).json({ message: "Plan not found" });
        const successUrl = process.env.STRIPE_SUCCESS_URL ||
            "http://localhost:3000/checkout/success";
        const cancelUrl = process.env.STRIPE_CANCEL_URL || "http://localhost:3000/checkout/cancel";
        const session = await stripeService.createCheckoutSessionForSubscription(userId, plan, successUrl, cancelUrl);
        res.status(201).json({ url: session.url, sessionId: session.id });
    }
    async webhook(req, res) {
        const sig = req.headers["stripe-signature"] || "";
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
        const payload = req.rawBody;
        if (!payload) {
            return res
                .status(400)
                .send("Webhook payload missing (server not configured to provide raw body)");
        }
        let event;
        try {
            event = stripeService.constructEvent(payload, sig, webhookSecret);
        }
        catch (err) {
            console.error("Stripe webhook signature verification failed:", err?.message);
            return res.status(400).send(`Webhook Error: ${err?.message}`);
        }
        switch (event.type) {
            case "checkout.session.completed":
                {
                    const session = event.data.object;
                    await billingDb.upsertPaymentFromStripe(event, "initiated");
                }
                break;
            case "invoice.paid":
                {
                    const invoice = event.data.object;
                    await billingDb.createInvoiceFromStripe(invoice);
                    await billingDb.upsertPaymentFromStripe(event, "successful");
                }
                break;
            case "invoice.payment_failed":
                {
                    const invoice = event.data.object;
                    await billingDb.upsertPaymentFromStripe(event, "failed");
                }
                break;
            case "customer.subscription.updated":
            case "customer.subscription.created":
                {
                    const sub = event.data.object;
                    await billingDb.updateLocalSubscriptionOnStripeUpdate(sub);
                }
                break;
            default:
                break;
        }
        res.json({ received: true });
    }
}
exports.PaymentController = PaymentController;
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "createCheckout", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "webhook", null);
