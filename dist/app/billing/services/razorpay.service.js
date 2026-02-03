"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RazorpayService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const razorpay_1 = __importDefault(require("razorpay"));
class RazorpayService {
    constructor() {
        this.client = null;
        // ✅ do NOT initialize Razorpay here (it throws if key_id/oauthToken missing)
        const keyId = process.env.RAZORPAY_KEY_ID || "";
        const oauthToken = process.env.RAZORPAY_OAUTH_TOKEN || "";
        if (!keyId && !oauthToken) {
            console.warn("[RazorpayService] Razorpay not configured. Set RAZORPAY_KEY_ID+RAZORPAY_KEY_SECRET or RAZORPAY_OAUTH_TOKEN");
        }
    }
    getClient() {
        if (this.client)
            return this.client;
        const keyId = process.env.RAZORPAY_KEY_ID || "";
        const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
        const oauthToken = process.env.RAZORPAY_OAUTH_TOKEN || "";
        // Razorpay SDK requires key_id or oauthToken
        if (!oauthToken && !keyId) {
            throw new Error("Razorpay not configured: set RAZORPAY_KEY_ID (or RAZORPAY_OAUTH_TOKEN)");
        }
        // key_secret required with key_id flow
        if (!oauthToken && !keySecret) {
            throw new Error("Razorpay not configured: set RAZORPAY_KEY_SECRET (required with RAZORPAY_KEY_ID)");
        }
        // ✅ create client only when we really need it
        this.client = new razorpay_1.default(oauthToken
            ? { oauthToken }
            : {
                key_id: keyId,
                key_secret: keySecret,
            });
        return this.client;
    }
    getPublicKeyId() {
        return process.env.RAZORPAY_KEY_ID || "";
    }
    async createOrder(args) {
        const client = this.getClient();
        return client.orders.create({
            amount: args.amountPaise,
            currency: args.currency,
            receipt: args.receipt,
            notes: args.notes || {},
        });
    }
    verifyWebhookSignature(rawBody, signature, webhookSecret) {
        const expected = crypto_1.default
            .createHmac("sha256", webhookSecret)
            .update(rawBody)
            .digest("hex");
        return expected === signature;
    }
    verifyCheckoutSignature(orderId, paymentId, signature) {
        const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
        if (!keySecret)
            return false;
        const payload = `${orderId}|${paymentId}`;
        const expected = crypto_1.default
            .createHmac("sha256", keySecret)
            .update(payload)
            .digest("hex");
        return expected === signature;
    }
}
exports.RazorpayService = RazorpayService;
