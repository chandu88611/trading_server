"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingDBService = void 0;
const data_source_1 = __importDefault(require("../../../db/data-source"));
const entity_1 = require("../../../entity");
const entity_2 = require("../../../entity");
class BillingDBService {
    constructor() {
        this.invoiceRepo = data_source_1.default.getRepository(entity_1.SubscriptionInvoice);
        this.paymentRepo = data_source_1.default.getRepository(entity_1.SubscriptionPayment);
        this.userSubRepo = data_source_1.default.getRepository(entity_1.UserSubscription);
        this.planRepo = data_source_1.default.getRepository(entity_1.SubscriptionPlan);
        this.userRepo = data_source_1.default.getRepository(entity_2.User);
    }
    async createInvoiceFromStripe(stripeInvoice) {
        const metadata = stripeInvoice?.lines?.data?.[0]?.price?.product?.metadata;
        const planId = metadata?.planId ? Number(metadata.planId) : undefined;
        const userId = stripeInvoice?.metadata?.userId
            ? Number(stripeInvoice.metadata.userId)
            : undefined;
        const invoice = this.invoiceRepo.create({
            subscriptionId: stripeInvoice.subscription ? Number(stripeInvoice.subscription) : 0,
            userId: userId,
            planId: planId,
            amountCents: stripeInvoice.amount_paid || stripeInvoice.amount_due || 0,
            currency: stripeInvoice.currency ? stripeInvoice.currency.toUpperCase() : "INR",
            status: stripeInvoice.paid ? "paid" : "pending",
            billingPeriodStart: new Date(stripeInvoice.period_start * 1000),
            billingPeriodEnd: new Date(stripeInvoice.period_end * 1000),
            paymentGateway: "stripe",
            paymentReference: stripeInvoice.id,
            metadata: stripeInvoice,
        });
        return this.invoiceRepo.save(invoice);
    }
    async upsertPaymentFromStripe(stripeEvent, status) {
        const gatewayEventId = stripeEvent.id;
        const existing = await this.paymentRepo.findOne({
            where: { gatewayEventId },
        });
        if (existing)
            return existing;
        const invoiceId = null;
        const userId = stripeEvent.data?.object?.customer_metadata?.userId
            ? Number(stripeEvent.data.object.customer_metadata.userId)
            : undefined;
        const amountCents = stripeEvent.data?.object?.amount_paid ?? stripeEvent.data?.object?.amount ?? 0;
        const payment = this.paymentRepo.create({
            invoiceId,
            userId: userId,
            status: status,
            amountCents,
            currency: (stripeEvent.data?.object?.currency || "INR").toUpperCase(),
            gateway: "stripe",
            gatewayEventId: gatewayEventId,
            gatewayPayload: stripeEvent,
        });
        return this.paymentRepo.save(payment);
    }
    async updateLocalSubscriptionOnStripeUpdate(stripeSub) {
        const planId = stripeSub?.items?.data?.[0]?.price?.product?.metadata?.planId;
        const userId = stripeSub?.metadata?.userId || stripeSub?.customer_metadata?.userId;
        if (!userId || !planId)
            return null;
        const existing = await this.userSubRepo.findOne({ where: { userId: Number(userId) } });
        const startDate = new Date(stripeSub.current_period_start * 1000);
        const endDate = new Date(stripeSub.current_period_end * 1000);
        if (existing) {
            existing.startDate = startDate;
            existing.endDate = endDate;
            existing.status = stripeSub.status;
            existing.planId = Number(planId);
            existing.metadata = stripeSub;
            return this.userSubRepo.save(existing);
        }
        else {
            const s = this.userSubRepo.create({
                userId: Number(userId),
                planId: Number(planId),
                startDate,
                endDate,
                status: stripeSub.status,
                metadata: stripeSub,
            });
            return this.userSubRepo.save(s);
        }
    }
}
exports.BillingDBService = BillingDBService;
