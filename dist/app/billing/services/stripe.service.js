"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeService = void 0;
exports.toStripeInterval = toStripeInterval;
const stripe_1 = __importDefault(require("stripe"));
const entity_1 = require("../../../entity");
const data_source_1 = __importDefault(require("../../../db/data-source"));
const strip_interface_1 = require("../enums/strip.interface");
const stripe = new stripe_1.default(process.env.STRIPE_API_KEY || "");
class StripeService {
    constructor() {
        this.planRepo = data_source_1.default.getRepository(entity_1.SubscriptionPlan);
    }
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
    constructEvent(payload, sigHeader, webhookSecret) {
        return stripe.webhooks.constructEvent(payload, sigHeader, webhookSecret);
    }
}
exports.StripeService = StripeService;
function toStripeInterval(interval) {
    switch (interval) {
        case strip_interface_1.BillingInterval.MONTHLY:
            return "month";
        case strip_interface_1.BillingInterval.YEARLY:
            return "year";
        default:
            throw new Error(`Unsupported interval: ${interval}`);
    }
}
