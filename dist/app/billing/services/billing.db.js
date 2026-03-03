"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingDBService = void 0;
const data_source_1 = __importDefault(require("../../../db/data-source"));
const entity_1 = require("../../../entity");
const RazorpayOrder_1 = require("../../../entity/RazorpayOrder");
const razorpay_service_1 = require("./razorpay.service");
class BillingDBService {
    constructor() {
        this.invoiceRepo = data_source_1.default.getRepository(entity_1.SubscriptionInvoice);
        this.paymentRepo = data_source_1.default.getRepository(entity_1.SubscriptionPayment);
        this.userSubRepo = data_source_1.default.getRepository(entity_1.UserSubscription);
        this.planRepo = data_source_1.default.getRepository(entity_1.SubscriptionPlan);
        this.userRepo = data_source_1.default.getRepository(entity_1.User);
        this.rzOrderRepo = data_source_1.default.getRepository(RazorpayOrder_1.RazorpayOrder);
        this.razorpay = new razorpay_service_1.RazorpayService();
    }
    async getUserSubscriptionEntity(userId) {
        return this.userSubRepo.findOne({ where: { userId } });
    }
    async getCurrentSubscription(userId) {
        const sub = await this.userSubRepo.findOne({ where: { userId } });
        if (!sub)
            return null;
        const plan = await this.planRepo.findOne({ where: { id: sub.planId } });
        return {
            id: sub.id,
            userId: sub.userId,
            planId: sub.planId,
            status: sub.status,
            statusV2: sub.statusV2,
            startDate: sub.startDate,
            endDate: sub.endDate,
            autoRenew: sub.autoRenew,
            webhookToken: sub.webhookToken,
            executionEnabled: sub.executionEnabled,
            liquidateOnlyUntil: sub.liquidateOnlyUntil,
            plan: plan
                ? {
                    id: plan.id,
                    name: plan.name,
                    description: plan.description,
                    priceCents: plan.priceCents,
                    currency: plan.currency,
                    interval: plan.interval,
                    isActive: plan.isActive,
                    featureFlags: plan.featureFlags,
                    metadata: plan.metadata,
                    category: plan.category,
                    executionFlow: plan.executionFlow,
                }
                : null,
        };
    }
    async createRazorpayCheckout(userId, plan) {
        const currency = plan.currency || "INR";
        const amountCents = Number(plan.priceCents || 0);
        const amountPaise = amountCents;
        const now = new Date();
        const billingPeriodStart = now;
        const billingPeriodEnd = this.computePeriodEnd(now, plan.interval);
        return data_source_1.default.transaction(async (trx) => {
            const invoiceRepo = trx.getRepository(entity_1.SubscriptionInvoice);
            const rzRepo = trx.getRepository(RazorpayOrder_1.RazorpayOrder);
            const invoice = invoiceRepo.create({
                subscriptionId: null,
                userId,
                planId: plan.id,
                amountCents: amountCents,
                currency: currency,
                status: "pending",
                billingPeriodStart,
                billingPeriodEnd,
                paymentGateway: "razorpay",
                paymentReference: null,
                metadata: { planId: plan.id },
            });
            const savedInvoice = await invoiceRepo.save(invoice);
            const order = await this.razorpay.createOrder({
                amountPaise,
                currency,
                receipt: `inv_${savedInvoice.id}`,
                notes: {
                    invoiceId: String(savedInvoice.id),
                    userId: String(userId),
                    planId: String(plan.id),
                },
            });
            await rzRepo.save(rzRepo.create({
                invoiceId: String(savedInvoice.id),
                userId: String(userId),
                razorpayOrderId: order.id,
                receipt: order.receipt || null,
                amountCents: amountCents,
                currency: currency,
                status: (order.status || "created"),
                notes: order.notes || {},
            }));
            savedInvoice.paymentReference = order.id;
            savedInvoice.metadata = {
                ...savedInvoice.metadata,
                razorpay_order_id: order.id,
            };
            await invoiceRepo.save(savedInvoice);
            return {
                invoiceId: Number(savedInvoice.id),
                razorpayOrderId: order.id,
                amountPaise,
                currency,
            };
        });
    }
    async markInvoicePaidFromClientVerification(args) {
        return data_source_1.default.transaction(async (trx) => {
            const invoiceRepo = trx.getRepository(entity_1.SubscriptionInvoice);
            const paymentRepo = trx.getRepository(entity_1.SubscriptionPayment);
            const userSubRepo = trx.getRepository(entity_1.UserSubscription);
            const invoice = await invoiceRepo.findOne({ where: { id: args.invoiceId } });
            if (!invoice)
                throw { status: 404, message: "Invoice not found" };
            if (String(invoice.userId) !== String(args.userId)) {
                throw { status: 403, message: "Invoice does not belong to user" };
            }
            const exists = await paymentRepo.findOne({
                where: { gatewayEventId: args.razorpayPaymentId },
            });
            if (!exists) {
                await paymentRepo.save(paymentRepo.create({
                    invoiceId: invoice.id,
                    userId: args.userId,
                    status: "successful",
                    amountCents: invoice.amountCents,
                    currency: invoice.currency,
                    gateway: "razorpay",
                    gatewayEventId: args.razorpayPaymentId,
                    gatewayPayload: args.gatewayPayload,
                }));
            }
            invoice.status = "paid";
            invoice.paymentGateway = "razorpay";
            invoice.paymentReference = args.razorpayOrderId;
            invoice.metadata = {
                ...invoice.metadata,
                razorpay_payment_id: args.razorpayPaymentId,
                razorpay_order_id: args.razorpayOrderId,
                source: "client_verify",
            };
            await invoiceRepo.save(invoice);
            const updatedSub = await this.upsertSubscriptionFromInvoice(trx, invoice);
            return {
                invoice,
                subscription: updatedSub,
            };
        });
    }
    async handleRazorpayPaymentCaptured(event) {
        const payment = event?.payload?.payment?.entity;
        if (!payment)
            return;
        const razorpayPaymentId = payment.id;
        const razorpayOrderId = payment.order_id;
        const notes = payment.notes || {};
        const invoiceId = Number(notes.invoiceId || 0);
        const userId = Number(notes.userId || 0);
        const existing = await this.paymentRepo.findOne({
            where: { gatewayEventId: razorpayPaymentId },
        });
        if (existing)
            return;
        await data_source_1.default.transaction(async (trx) => {
            const invoiceRepo = trx.getRepository(entity_1.SubscriptionInvoice);
            const paymentRepo = trx.getRepository(entity_1.SubscriptionPayment);
            let invoice = null;
            if (invoiceId) {
                invoice = await invoiceRepo.findOne({ where: { id: invoiceId } });
            }
            if (!invoice && razorpayOrderId) {
                invoice = await invoiceRepo.findOne({
                    where: { paymentReference: razorpayOrderId },
                });
            }
            if (!invoice) {
                await paymentRepo.save(paymentRepo.create({
                    invoiceId: null,
                    userId: userId || null,
                    status: "successful",
                    amountCents: Math.round(Number(payment.amount || 0)),
                    currency: String(payment.currency || "INR").toUpperCase(),
                    gateway: "razorpay",
                    gatewayEventId: razorpayPaymentId,
                    gatewayPayload: event,
                }));
                return;
            }
            await paymentRepo.save(paymentRepo.create({
                invoiceId: invoice.id,
                userId: Number(invoice.userId),
                status: "successful",
                amountCents: Number(invoice.amountCents),
                currency: String(invoice.currency || "INR").toUpperCase(),
                gateway: "razorpay",
                gatewayEventId: razorpayPaymentId,
                gatewayPayload: event,
            }));
            invoice.status = "paid";
            invoice.paymentGateway = "razorpay";
            invoice.paymentReference = razorpayOrderId || invoice.paymentReference;
            invoice.metadata = {
                ...(invoice.metadata || {}),
                razorpay_payment_id: razorpayPaymentId,
                razorpay_order_id: razorpayOrderId,
                source: "webhook",
            };
            await invoiceRepo.save(invoice);
            await this.upsertSubscriptionFromInvoice(trx, invoice);
        });
    }
    async handleRazorpayPaymentFailed(event) {
        const payment = event?.payload?.payment?.entity;
        if (!payment)
            return;
        const razorpayPaymentId = payment.id;
        const existing = await this.paymentRepo.findOne({
            where: { gatewayEventId: razorpayPaymentId },
        });
        if (existing)
            return;
        const notes = payment.notes || {};
        const invoiceId = Number(notes.invoiceId || 0);
        const userId = Number(notes.userId || 0);
        await data_source_1.default.transaction(async (trx) => {
            const invoiceRepo = trx.getRepository(entity_1.SubscriptionInvoice);
            const paymentRepo = trx.getRepository(entity_1.SubscriptionPayment);
            const invoice = invoiceId
                ? await invoiceRepo.findOne({ where: { id: invoiceId } })
                : null;
            await paymentRepo.save(paymentRepo.create({
                invoiceId: invoice ? invoice.id : null,
                userId: invoice ? Number(invoice.userId) : userId || null,
                status: "failed",
                amountCents: invoice ? Number(invoice.amountCents) : Math.round(Number(payment.amount || 0)),
                currency: String(payment.currency || "INR").toUpperCase(),
                gateway: "razorpay",
                gatewayEventId: razorpayPaymentId,
                gatewayPayload: event,
            }));
            if (invoice) {
                invoice.status = "failed";
                invoice.metadata = { ...(invoice.metadata || {}), source: "webhook_failed" };
                await invoiceRepo.save(invoice);
            }
        });
    }
    async cancelLocalSubscription(userId, immediate) {
        const sub = await this.userSubRepo.findOne({ where: { userId } });
        if (!sub)
            throw { status: 400, message: "No active subscription to cancel" };
        sub.autoRenew = false;
        if (immediate) {
            sub.status = "canceled";
            sub.statusV2 = "canceled";
            sub.canceledAt = new Date();
            sub.endDate = new Date();
            sub.executionEnabled = false;
        }
        else {
            sub.cancelAt = sub.endDate || new Date();
            sub.canceledAt = new Date();
            sub.statusV2 = "canceled";
        }
        return this.userSubRepo.save(sub);
    }
    async upsertSubscriptionFromInvoice(trx, invoice) {
        const userSubRepo = trx.getRepository(entity_1.UserSubscription);
        const userId = Number(invoice.userId);
        const planId = Number(invoice.planId);
        const existing = await userSubRepo.findOne({
            where: {
                userId,
                planId,
                statusV2: "active",
            },
        });
        const startDate = new Date(invoice.billingPeriodStart);
        const endDate = new Date(invoice.billingPeriodEnd);
        if (existing) {
            const currentEnd = existing.endDate ? new Date(existing.endDate) : null;
            if (currentEnd && currentEnd > startDate) {
                existing.startDate = existing.startDate || startDate;
                existing.endDate = endDate > currentEnd ? endDate : currentEnd;
            }
            else {
                existing.startDate = startDate;
                existing.endDate = endDate;
            }
            existing.planId = planId;
            existing.status = "active";
            existing.statusV2 = "active";
            existing.executionEnabled = true;
            existing.metadata = {
                ...(existing.metadata || {}),
                last_invoice_id: invoice.id,
                last_payment_gateway: "razorpay",
            };
            return userSubRepo.save(existing);
        }
        const created = userSubRepo.create({
            userId,
            planId,
            startDate,
            endDate,
            status: "active",
            statusV2: "active",
            metadata: { last_invoice_id: invoice.id, last_payment_gateway: "razorpay" },
            autoRenew: false,
            executionEnabled: true,
        });
        return userSubRepo.save(created);
    }
    computePeriodEnd(start, interval) {
        const d = new Date(start);
        if (interval === "yearly") {
            d.setFullYear(d.getFullYear() + 1);
            return d;
        }
        if (interval === "lifetime") {
            d.setFullYear(d.getFullYear() + 100);
            return d;
        }
        d.setMonth(d.getMonth() + 1);
        return d;
    }
}
exports.BillingDBService = BillingDBService;
