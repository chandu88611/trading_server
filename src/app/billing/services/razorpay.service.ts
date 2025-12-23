import crypto from "crypto";
import Razorpay from "razorpay";

export class RazorpayService {
  private client: Razorpay;

  constructor() {
    const keyId = process.env.RAZORPAY_KEY_ID || "";
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "";

    if (!keyId || !keySecret) {
      console.warn("[RazorpayService] Missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET");
    }

    this.client = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
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
    return this.client.orders.create({
      amount: args.amountPaise,
      currency: args.currency,
      receipt: args.receipt,
      notes: args.notes || {},
    });
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string, webhookSecret: string) {
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
    const expected = crypto.createHmac("sha256", keySecret).update(payload).digest("hex");
    return expected === signature;
  }
}
