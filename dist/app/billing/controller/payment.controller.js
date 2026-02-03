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
const error_handler_1 = require("../../../types/error-handler");
const razorpay_service_1 = require("../services/razorpay.service");
const billing_db_1 = require("../services/billing.db");
const razorpayService = new razorpay_service_1.RazorpayService();
const billingDb = new billing_db_1.BillingDBService();
function getAuthUserId(req) {
    const raw = req.auth?.id ?? req.auth?.userId;
    return Number(raw || 0);
}
class PaymentController {
    async createCheckout(req, res) {
        const userId = getAuthUserId(req);
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const { planId } = req.body;
        if (!planId)
            return res.status(400).json({ message: "planId required" });
        const planRepo = (await Promise.resolve().then(() => __importStar(require("../../../db/data-source")))).default.getRepository("SubscriptionPlan");
        const plan = (await planRepo.findOne({ where: { id: planId } }));
        if (!plan)
            return res.status(404).json({ message: "Plan not found" });
        if (!plan.isActive)
            return res.status(400).json({ message: "Plan is inactive" });
        const checkout = await billingDb.createRazorpayCheckout(userId, plan);
        return res.status(201).json({
            message: "Checkout created",
            data: {
                keyId: razorpayService.getPublicKeyId(),
                orderId: checkout.razorpayOrderId,
                amount: checkout.amountPaise,
                currency: checkout.currency,
                invoiceId: checkout.invoiceId,
                planId: plan.id,
                planName: plan.name,
            },
        });
    }
    async verifyPayment(req, res) {
        const userId = getAuthUserId(req);
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, invoiceId, } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !invoiceId) {
            return res.status(400).json({ message: "Missing payment verification fields" });
        }
        const ok = razorpayService.verifyCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
        if (!ok)
            return res.status(400).json({ message: "Invalid payment signature" });
        const updated = await billingDb.markInvoicePaidFromClientVerification({
            userId,
            invoiceId,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            gatewayPayload: { razorpay_order_id, razorpay_payment_id, razorpay_signature },
        });
        return res.status(200).json({
            message: "Payment verified",
            data: updated,
        });
    }
    async getCurrentSubscription(req, res) {
        const userId = getAuthUserId(req);
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const sub = await billingDb.getCurrentSubscription(userId);
        if (!sub)
            return res.status(200).json({ message: "No subscription", data: null });
        return res.status(200).json({ message: "Fetched current subscription", data: sub });
    }
    async cancelSubscription(req, res) {
        const userId = getAuthUserId(req);
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const { immediate } = (req.body || {});
        const updated = await billingDb.cancelLocalSubscription(userId, Boolean(immediate));
        return res.status(200).json({
            message: immediate ? "Subscription canceled immediately" : "Subscription canceled (access until end_date)",
            data: updated,
        });
    }
    async webhook(req, res) {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
        if (!webhookSecret)
            return res.status(500).send("RAZORPAY_WEBHOOK_SECRET missing");
        const signature = req.headers["x-razorpay-signature"] || "";
        const rawBody = req.body;
        if (!rawBody || !Buffer.isBuffer(rawBody)) {
            return res.status(400).send("Webhook raw body missing");
        }
        const isValid = razorpayService.verifyWebhookSignature(rawBody, signature, webhookSecret);
        if (!isValid)
            return res.status(400).send("Invalid webhook signature");
        let event;
        try {
            event = JSON.parse(rawBody.toString("utf8"));
        }
        catch {
            return res.status(400).send("Invalid JSON payload");
        }
        const eventType = event?.event;
        switch (eventType) {
            case "payment.captured":
                await billingDb.handleRazorpayPaymentCaptured(event);
                break;
            case "payment.failed":
                await billingDb.handleRazorpayPaymentFailed(event);
                break;
            case "order.paid":
                break;
            default:
                break;
        }
        return res.status(200).json({ received: true });
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
], PaymentController.prototype, "verifyPayment", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "getCurrentSubscription", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "cancelSubscription", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "webhook", null);
