import { Request, Response } from "express";
import { ControllerError } from "../../../types/error-handler";
import { RazorpayService } from "../services/razorpay.service";
import { BillingDBService } from "../services/billing.db";
import { SubscriptionPlan } from "../../../entity";

const razorpayService = new RazorpayService();
const billingDb = new BillingDBService();

function getAuthUserId(req: Request): number {
  const raw = (req as any).auth?.id ?? (req as any).auth?.userId;
  return Number(raw || 0);
}

export class PaymentController {
  @ControllerError()
  async createCheckout(req: Request, res: Response) {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { planId } = req.body as { planId: number };
    if (!planId) return res.status(400).json({ message: "planId required" });

    const planRepo = (await import("../../../db/data-source")).default.getRepository(
      "SubscriptionPlan"
    );
    const plan = (await planRepo.findOne({ where: { id: planId } })) as SubscriptionPlan;

    if (!plan) return res.status(404).json({ message: "Plan not found" });
    if (!(plan as any).isActive) return res.status(400).json({ message: "Plan is inactive" });

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

  @ControllerError()
  async verifyPayment(req: Request, res: Response) {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      invoiceId,
    } = req.body as {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      invoiceId: number;
    };

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !invoiceId) {
      return res.status(400).json({ message: "Missing payment verification fields" });
    }

    const ok = razorpayService.verifyCheckoutSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!ok) return res.status(400).json({ message: "Invalid payment signature" });

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

  @ControllerError()
  async getCurrentSubscription(req: Request, res: Response) {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const sub = await billingDb.getCurrentSubscription(userId);
    if (!sub) return res.status(200).json({ message: "No subscription", data: null });

    return res.status(200).json({ message: "Fetched current subscription", data: sub });
  }

  @ControllerError()
  async cancelSubscription(req: Request, res: Response) {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { immediate } = (req.body || {}) as { immediate?: boolean };

    const updated = await billingDb.cancelLocalSubscription(userId, Boolean(immediate));

    return res.status(200).json({
      message: immediate ? "Subscription canceled immediately" : "Subscription canceled (access until end_date)",
      data: updated,
    });
  }

  @ControllerError()
  async webhook(req: Request, res: Response) {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
    if (!webhookSecret) return res.status(500).send("RAZORPAY_WEBHOOK_SECRET missing");

    const signature = (req.headers["x-razorpay-signature"] as string) || "";
    const rawBody = req.body as Buffer;

    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      return res.status(400).send("Webhook raw body missing");
    }

    const isValid = razorpayService.verifyWebhookSignature(rawBody, signature, webhookSecret);
    if (!isValid) return res.status(400).send("Invalid webhook signature");

    let event: any;
    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
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
