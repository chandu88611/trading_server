"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeService = void 0;
exports.toStripeInterval = toStripeInterval;
const stripe_1 = __importDefault(require("stripe"));
const strip_interface_1 = require("../enums/strip.interface");
const stripe = new stripe_1.default(process.env.STRIPE_API_KEY || "");
class StripeService {
    async getOrCreateCustomer(userId, email, name) {
        const customer = await stripe.customers.create({
            email,
            name,
            metadata: { userId: String(userId) },
        });
        return customer;
    }
    async createCheckoutSessionForSubscription(userId, plan, successUrl, cancelUrl) {
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
            customer: (await this.getOrCreateCustomer(userId, undefined, undefined)).id,
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
    async cancelSubscriptionAtPeriodEnd(stripeSubscriptionId) {
        return stripe.subscriptions.update(stripeSubscriptionId, {
            cancel_at_period_end: true,
        });
    }
    async cancelSubscriptionImmediate(stripeSubscriptionId) {
        return stripe.subscriptions.cancel(stripeSubscriptionId);
    }
    constructEvent(payload, sigHeader, webhookSecret) {
        return stripe.webhooks.constructEvent(payload, sigHeader, webhookSecret);
    }
}
exports.StripeService = StripeService;
function toStripeInterval(interval) {
    switch (interval) {
        case strip_interface_1.BillingInterval.MONTHLY:
        case "monthly":
            return "month";
        case strip_interface_1.BillingInterval.YEARLY:
        case "yearly":
            return "year";
        default:
            throw new Error(`Unsupported interval: ${interval}`);
    }
}
