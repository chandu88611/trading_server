import { Request, Response } from "express";
import { StripeService } from "../services/stripe.service";
import { BillingDBService } from "../services/billing.db";
import { ControllerError } from "../../../types/error-handler";
import { SubscriptionPlan } from "../../../entity";

const stripeService = new StripeService();
const billingDb = new BillingDBService();

export class PaymentController {
  @ControllerError()
  async createCheckout(req: Request, res: Response) {
    const userId = (req as any).auth?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { planId } = req.body as { planId: number };
    if (!planId) return res.status(400).json({ message: "planId required" });

    // fetch plan from DB
    const planRepo = (
      await import("../../../db/data-source")
    ).default.getRepository("SubscriptionPlan");
    const plan = (await planRepo.findOne({
      where: { id: planId },
    })) as SubscriptionPlan;

    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const successUrl =
      process.env.STRIPE_SUCCESS_URL ||
      "http://localhost:3000/checkout/success";
    const cancelUrl =
      process.env.STRIPE_CANCEL_URL || "http://localhost:3000/checkout/cancel";

    const session = await stripeService.createCheckoutSessionForSubscription(
      userId,
      plan,
      successUrl,
      cancelUrl
    );

    res.status(201).json({ url: session.url, sessionId: session.id });
  }

  @ControllerError()
  async getCurrentSubscription(req: Request, res: Response) {
    const userId = Number((req as any).auth?.userId);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const sub = await billingDb.getCurrentSubscription(userId);

    if (!sub) return res.status(200).json({ message: "No subscription", data: null });

    res.status(200).json({
      message: "Fetched current subscription",
      data: sub,
    });
  }

  @ControllerError()
  async cancelSubscription(req: Request, res: Response) {
    const userId = Number((req as any).auth?.userId);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { immediate } = (req.body || {}) as { immediate?: boolean };

    const existing = await billingDb.getUserSubscriptionEntity(userId);
    if (!existing) {
      return res.status(400).json({ message: "No active subscription to cancel" });
    }

    const stripeSubId = billingDb.extractStripeSubscriptionId(existing);
    if (!stripeSubId) {
      return res.status(400).json({
        message: "Stripe subscription id missing in local subscription metadata",
      });
    }

    const stripeSub = immediate
      ? await stripeService.cancelSubscriptionImmediate(stripeSubId)
      : await stripeService.cancelSubscriptionAtPeriodEnd(stripeSubId);

    const updatedLocal = await billingDb.updateLocalSubscriptionOnStripeUpdate(stripeSub);

    res.status(200).json({
      message: immediate ? "Subscription canceled immediately" : "Subscription will cancel at period end",
      data: updatedLocal,
    });
  }

  @ControllerError()
  async webhook(req: Request, res: Response) {
    const sig = (req.headers["stripe-signature"] as string) || "";
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

    const payload = (req as any).rawBody as Buffer;
    if (!payload) {
      return res
        .status(400)
        .send(
          "Webhook payload missing (server not configured to provide raw body)"
        );
    }

    let event;
    try {
      event = stripeService.constructEvent(payload, sig, webhookSecret);
    } catch (err: any) {
      console.error(
        "Stripe webhook signature verification failed:",
        err?.message
      );
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
