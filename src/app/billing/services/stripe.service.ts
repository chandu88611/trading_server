import Stripe from "stripe";
import { SubscriptionPlan } from "../../../entity";
import { BillingInterval } from "../enums/strip.interface";

const stripe = new Stripe(process.env.STRIPE_API_KEY || "");

export class StripeService {
  async getOrCreateCustomer(userId: number, email?: string, name?: string) {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: { userId: String(userId) },
    });

    return customer;
  }

  async createCheckoutSessionForSubscription(
    userId: number,
    plan: SubscriptionPlan,
    successUrl: string,
    cancelUrl: string
  ) {
    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description || undefined,
      metadata: { planId: String(plan.id) },
    });

    const pricing = plan.pricing;
    if (!pricing) {
      throw new Error("plan_pricing_not_found");
    }

    const priceUnit = pricing.priceInr;
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: priceUnit,
      currency: String(pricing.currency || "INR").toLowerCase(),
      recurring: { interval: toStripeInterval(pricing.interval) },
      metadata: { planId: String(plan.id) },
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: (
        await this.getOrCreateCustomer(userId, undefined, undefined)
      ).id,
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: String(userId),
        planId: String(plan.id),
      },
    });

    return session;
  }
  async cancelSubscriptionAtPeriodEnd(stripeSubscriptionId: string) {
    return stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  }

  async cancelSubscriptionImmediate(stripeSubscriptionId: string) {
    return stripe.subscriptions.cancel(stripeSubscriptionId);
  }

  constructEvent(payload: Buffer, sigHeader: string, webhookSecret: string) {
    return stripe.webhooks.constructEvent(payload, sigHeader, webhookSecret);
  }
}

export function toStripeInterval(
  interval: BillingInterval | string
): Stripe.Price.Recurring.Interval {
  switch (interval) {
    case BillingInterval.MONTHLY:
    case "monthly":
      return "month";
    case BillingInterval.YEARLY:
    case "yearly":
      return "year";
    default:
      throw new Error(`Unsupported interval: ${interval}`);
  }
}
