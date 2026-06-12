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
const razorpayx_service_1 = require("../services/razorpayx.service");
const billing_db_1 = require("../services/billing.db");
const entity_1 = require("../../../entity");
const auth_1 = require("../../../middleware/auth");
const constants_1 = require("../../../types/constants");
const razorpayService = new razorpay_service_1.RazorpayService();
const razorpayXService = new razorpayx_service_1.RazorpayXService();
const billingDb = new billing_db_1.BillingDBService();
function getAuthUserId(req) {
    const raw = req.auth?.id ?? req.auth?.userId;
    return Number(raw || 0);
}
class PaymentController {
    ensureNonAdmin(req) {
        const roles = req.auth?.roles ?? [];
        if (roles.includes(auth_1.Roles.ADMIN)) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "admin_subscriptions_not_allowed",
            };
        }
    }
    ensureAdmin(req) {
        const roles = req.auth?.roles ?? [];
        if (!roles.includes(auth_1.Roles.ADMIN)) {
            throw {
                statusCode: constants_1.HttpStatusCode._UNAUTHORISED,
                message: "Admin access required",
            };
        }
    }
    async createCheckout(req, res) {
        this.ensureNonAdmin(req);
        const userId = getAuthUserId(req);
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const { planId } = req.body;
        if (!planId)
            return res.status(400).json({ message: "planId required" });
        const planRepo = (await Promise.resolve().then(() => __importStar(require("../../../db/data-source")))).default.getRepository(entity_1.SubscriptionPlan);
        const plan = (await planRepo.findOne({
            where: { id: planId },
            relations: { pricing: true },
        }));
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
        this.ensureNonAdmin(req);
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
    async getWallet(req, res) {
        const userId = getAuthUserId(req);
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const wallet = await billingDb.getWalletSummary(userId);
        return res.status(200).json({
            message: "Wallet fetched successfully",
            data: wallet,
        });
    }
    async listWithdrawals(req, res) {
        const userId = getAuthUserId(req);
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const withdrawals = await billingDb.listWithdrawals(userId);
        return res.status(200).json({
            message: "Withdrawals fetched successfully",
            data: withdrawals,
        });
    }
    async createWithdrawal(req, res) {
        const userId = getAuthUserId(req);
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const { amount } = req.body;
        if (typeof amount !== "number" || !Number.isFinite(amount)) {
            return res.status(400).json({ message: "amount must be a number" });
        }
        const withdrawal = await billingDb.createWithdrawalRequest(userId, amount);
        return res.status(201).json({
            message: "Withdrawal requested",
            data: withdrawal,
        });
    }
    async listAdminWithdrawals(req, res) {
        this.ensureAdmin(req);
        const withdrawals = await billingDb.listAdminWithdrawals();
        return res.status(200).json({
            message: "Admin withdrawals fetched successfully",
            data: withdrawals,
        });
    }
    async approveWithdrawal(req, res) {
        this.ensureAdmin(req);
        const adminUserId = getAuthUserId(req);
        const withdrawalId = Number(req.params.withdrawalId);
        const notes = String(req.body?.notes ?? "").trim() || null;
        if (!Number.isFinite(withdrawalId) || withdrawalId <= 0) {
            return res.status(400).json({ message: "Invalid withdrawalId" });
        }
        const withdrawal = await billingDb.approveWithdrawalRequest(withdrawalId, adminUserId, notes);
        return res.status(200).json({
            message: "Withdrawal approved",
            data: withdrawal,
        });
    }
    async rejectWithdrawal(req, res) {
        this.ensureAdmin(req);
        const adminUserId = getAuthUserId(req);
        const withdrawalId = Number(req.params.withdrawalId);
        const notes = String(req.body?.notes ?? req.body?.reason ?? "").trim() || null;
        if (!Number.isFinite(withdrawalId) || withdrawalId <= 0) {
            return res.status(400).json({ message: "Invalid withdrawalId" });
        }
        const withdrawal = await billingDb.rejectWithdrawalRequest(withdrawalId, adminUserId, notes);
        return res.status(200).json({
            message: "Withdrawal rejected",
            data: withdrawal,
        });
    }
    async updateWithdrawalSettings(req, res) {
        this.ensureAdmin(req);
        const { minWithdrawalAmountInr } = req.body;
        if (typeof minWithdrawalAmountInr !== "number" ||
            !Number.isFinite(minWithdrawalAmountInr)) {
            return res
                .status(400)
                .json({ message: "minWithdrawalAmountInr must be a number" });
        }
        const settings = await billingDb.updateWithdrawalSettings(minWithdrawalAmountInr);
        return res.status(200).json({
            message: "Withdrawal settings updated",
            data: settings,
        });
    }
    async getCurrentSubscription(req, res) {
        this.ensureNonAdmin(req);
        const userId = getAuthUserId(req);
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const sub = await billingDb.getCurrentSubscription(userId);
        if (!sub)
            return res.status(200).json({ message: "No subscription", data: null });
        return res.status(200).json({ message: "Fetched current subscription", data: sub });
    }
    async cancelSubscription(req, res) {
        this.ensureNonAdmin(req);
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
    async listMyInvoices(req, res) {
        const userId = Number(req.auth.userId);
        const page = Math.max(1, Number(req.query.page ?? 1));
        const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
        const { items, total } = await billingDb.listInvoicesForUser(userId, page, limit);
        res.json({ data: items, total, page, limit });
    }
    async webhook(req, res) {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
        if (!webhookSecret)
            return res.status(500).send("RAZORPAY_WEBHOOK_SECRET missing");
        const signature = req.headers["x-razorpay-signature"] || "";
        const rawBody = (req.rawBody ?? req.body);
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
                await billingDb.handleRazorpayOrderPaid(event);
                break;
            default:
                break;
        }
        return res.status(200).json({ received: true });
    }
    async payoutWebhook(req, res) {
        const webhookSecret = process.env.RAZORPAYX_WEBHOOK_SECRET || "";
        if (!webhookSecret)
            return res.status(500).send("RAZORPAYX_WEBHOOK_SECRET missing");
        const signature = req.headers["x-razorpay-signature"] || "";
        const rawBody = (req.rawBody ?? req.body);
        if (!rawBody || !Buffer.isBuffer(rawBody)) {
            return res.status(400).send("Webhook raw body missing");
        }
        const isValid = razorpayXService.verifyWebhookSignature(rawBody, signature, webhookSecret);
        if (!isValid)
            return res.status(400).send("Invalid webhook signature");
        let event;
        try {
            event = JSON.parse(rawBody.toString("utf8"));
        }
        catch {
            return res.status(400).send("Invalid JSON payload");
        }
        await billingDb.handleRazorpayXPayoutWebhook(event);
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
], PaymentController.prototype, "getWallet", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "listWithdrawals", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "createWithdrawal", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "listAdminWithdrawals", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "approveWithdrawal", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "rejectWithdrawal", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "updateWithdrawalSettings", null);
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
], PaymentController.prototype, "listMyInvoices", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "webhook", null);
__decorate([
    (0, error_handler_1.ControllerError)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "payoutWebhook", null);
