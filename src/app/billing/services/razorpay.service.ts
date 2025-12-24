import crypto from "crypto";
import Razorpay from "razorpay";

export class RazorpayService {
  private client: Razorpay | null = null;

  constructor() {
    // ✅ do NOT initialize Razorpay here (it throws if key_id/oauthToken missing)
    const keyId = process.env.RAZORPAY_KEY_ID || "";
    const oauthToken = process.env.RAZORPAY_OAUTH_TOKEN || "";

    if (!keyId && !oauthToken) {
      console.warn(
        "[RazorpayService] Razorpay not configured. Set RAZORPAY_KEY_ID+RAZORPAY_KEY_SECRET or RAZORPAY_OAUTH_TOKEN"
      );
    }
  }

  private getClient(): Razorpay {
    if (this.client) return this.client;

    const keyId = process.env.RAZORPAY_KEY_ID || "";
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
    const oauthToken = process.env.RAZORPAY_OAUTH_TOKEN || "";

    // Razorpay SDK requires key_id or oauthToken
    if (!oauthToken && !keyId) {
      throw new Error(
        "Razorpay not configured: set RAZORPAY_KEY_ID (or RAZORPAY_OAUTH_TOKEN)"
      );
    }

    // key_secret required with key_id flow
    if (!oauthToken && !keySecret) {
      throw new Error(
        "Razorpay not configured: set RAZORPAY_KEY_SECRET (required with RAZORPAY_KEY_ID)"
      );
    }

    // ✅ create client only when we really need it
    this.client = new Razorpay(
      oauthToken
        ? ({ oauthToken } as any)
        : ({
            key_id: keyId,
            key_secret: keySecret,
          } as any)
    );

    return this.client;
  }

  getPublicKeyId() {
    return process.env.RAZORPAY_KEY_ID || "";
  }

  async createOrder(args: {
    amountPaise: number;
    currency: string;
    receipt: string;
    notes?: Record<string, any>;
  }) {
    const client = this.getClient();
    return client.orders.create({
      amount: args.amountPaise,
      currency: args.currency,
      receipt: args.receipt,
      notes: args.notes || {},
    });
  }

  verifyWebhookSignature(
    rawBody: Buffer,
    signature: string,
    webhookSecret: string
  ) {
    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    return expected === signature;
  }

  verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
    if (!keySecret) return false;

    const payload = `${orderId}|${paymentId}`;
    const expected = crypto
      .createHmac("sha256", keySecret)
      .update(payload)
      .digest("hex");

    return expected === signature;
  }
}
