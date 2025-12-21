import Stripe from "stripe";
import { SubscriptionPlan } from "../../../entity";
import AppDataSource from "../../../db/data-source";
import { Repository } from "typeorm";
import { BillingInterval } from "../enums/strip.interface";

const stripe = new Stripe(process.env.STRIPE_API_KEY || "");

export class StripeService {
  private planRepo: Repository<SubscriptionPlan>;

  constructor() {
    this.planRepo = AppDataSource.getRepository(SubscriptionPlan);
  }

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

    const priceUnit = plan.priceCents;
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: priceUnit,
      currency: plan.currency.toLowerCase(),
      recurring: { interval: toStripeInterval(plan.interval) },
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
  interval: BillingInterval
): Stripe.Price.Recurring.Interval {
  switch (interval) {
    case BillingInterval.MONTHLY:
      return "month";
    case BillingInterval.YEARLY:
      return "year";
    default:
      throw new Error(`Unsupported interval: ${interval}`);
  }
}
