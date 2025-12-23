import AppDataSource from "../../../db/data-source";
import { DeepPartial, Repository } from "typeorm";
import {
  SubscriptionInvoice,
  SubscriptionPayment,
  UserSubscription,
  SubscriptionPlan,
  User,
} from "../../../entity";
import { RazorpayOrder } from "../../../entity/RazorpayOrder";
import { RazorpayService } from "./razorpay.service";

type CheckoutCreateResult = {
  invoiceId: number;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
};

export class BillingDBService {
  private invoiceRepo: Repository<SubscriptionInvoice>;
  private paymentRepo: Repository<SubscriptionPayment>;
  private userSubRepo: Repository<UserSubscription>;
  private planRepo: Repository<SubscriptionPlan>;
  private userRepo: Repository<User>;
  private rzOrderRepo: Repository<RazorpayOrder>;
  private razorpay: RazorpayService;

  constructor() {
    this.invoiceRepo = AppDataSource.getRepository(SubscriptionInvoice);
    this.paymentRepo = AppDataSource.getRepository(SubscriptionPayment);
    this.userSubRepo = AppDataSource.getRepository(UserSubscription);
    this.planRepo = AppDataSource.getRepository(SubscriptionPlan);
    this.userRepo = AppDataSource.getRepository(User);
    this.rzOrderRepo = AppDataSource.getRepository(RazorpayOrder);
    this.razorpay = new RazorpayService();
  }

  async getUserSubscriptionEntity(userId: number) {
    return this.userSubRepo.findOne({ where: { userId } as any });
  }

  async getCurrentSubscription(userId: number) {
    const sub = await this.userSubRepo.findOne({ where: { userId } as any });
    if (!sub) return null;

    const plan = await this.planRepo.findOne({ where: { id: (sub as any).planId } as any });

    return {
      id: (sub as any).id,
      userId: (sub as any).userId,
      planId: (sub as any).planId,
      status: (sub as any).status,
      statusV2: (sub as any).statusV2,
      startDate: (sub as any).startDate,
      endDate: (sub as any).endDate,
      autoRenew: (sub as any).autoRenew,
      webhookToken: (sub as any).webhookToken,
      executionEnabled: (sub as any).executionEnabled,
      liquidateOnlyUntil: (sub as any).liquidateOnlyUntil,
      plan: plan
        ? {
            id: (plan as any).id,
            name: (plan as any).name,
            description: (plan as any).description,
            priceCents: (plan as any).priceCents,
            currency: (plan as any).currency,
            interval: (plan as any).interval,
            isActive: (plan as any).isActive,
            featureFlags: (plan as any).featureFlags,
            metadata: (plan as any).metadata,
            category: (plan as any).category,
            executionFlow: (plan as any).executionFlow,
          }
        : null,
    };
  }

  async createRazorpayCheckout(userId: number, plan: SubscriptionPlan): Promise<CheckoutCreateResult> {
    const currency = (plan as any).currency || "INR";
    const amountCents = Number((plan as any).priceCents || 0);

    const amountPaise = amountCents;

    const now = new Date();
    const billingPeriodStart = now;
    const billingPeriodEnd = this.computePeriodEnd(now, (plan as any).interval);

    return AppDataSource.transaction(async (trx) => {
      const invoiceRepo = trx.getRepository(SubscriptionInvoice);
      const rzRepo = trx.getRepository(RazorpayOrder);
      
      
      const invoice: SubscriptionInvoice = invoiceRepo.create({
        subscriptionId: null as any, 
        userId,
        planId: (plan as any).id,
        amountCents: amountCents,
        currency: currency,
        status: "pending",
        billingPeriodStart,
        billingPeriodEnd,
        paymentGateway: "razorpay",
        paymentReference: null,
        metadata: { planId: (plan as any).id },
      } as DeepPartial<SubscriptionInvoice>);

      const savedInvoice = await invoiceRepo.save(invoice);

      const order = await this.razorpay.createOrder({
        amountPaise,
        currency,
        receipt: `inv_${savedInvoice.id}`,
        notes: {
          invoiceId: String(savedInvoice.id),
          userId: String(userId),
          planId: String((plan as any).id),
        },
      });

      await rzRepo.save(
        rzRepo.create({
          invoiceId: String(savedInvoice.id),
          userId: String(userId),
          razorpayOrderId: order.id,
          receipt: order.receipt || null,
          amountCents: amountCents,
          currency: currency,
          status: (order.status || "created") as any,
          notes: order.notes || {},
        })
      );

      (savedInvoice as any).paymentReference = order.id;
      (savedInvoice as any).metadata = {
        ...(savedInvoice as any).metadata,
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

  async markInvoicePaidFromClientVerification(args: {
    userId: number;
    invoiceId: number;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    gatewayPayload: any;
  }) {
    return AppDataSource.transaction(async (trx) => {
      const invoiceRepo = trx.getRepository(SubscriptionInvoice);
      const paymentRepo = trx.getRepository(SubscriptionPayment);
      const userSubRepo = trx.getRepository(UserSubscription);

      const invoice = await invoiceRepo.findOne({ where: { id: args.invoiceId } as any });
      if (!invoice) throw { status: 404, message: "Invoice not found" };

      if (String((invoice as any).userId) !== String(args.userId)) {
        throw { status: 403, message: "Invoice does not belong to user" };
      }

      const exists = await paymentRepo.findOne({
        where: { gatewayEventId: args.razorpayPaymentId } as any,
      });
      if (!exists) {
        await paymentRepo.save(
          paymentRepo.create({
            invoiceId: (invoice as any).id,
            userId: args.userId,
            status: "successful",
            amountCents: (invoice as any).amountCents,
            currency: (invoice as any).currency,
            gateway: "razorpay",
            gatewayEventId: args.razorpayPaymentId,
            gatewayPayload: args.gatewayPayload,
          } as any)
        );
      }

      (invoice as any).status = "paid";
      (invoice as any).paymentGateway = "razorpay";
      (invoice as any).paymentReference = args.razorpayOrderId;
      (invoice as any).metadata = {
        ...(invoice as any).metadata,
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


  async handleRazorpayPaymentCaptured(event: any) {
    const payment = event?.payload?.payment?.entity;
    if (!payment) return;

    const razorpayPaymentId = payment.id;
    const razorpayOrderId = payment.order_id;

    const notes = payment.notes || {};
    const invoiceId = Number(notes.invoiceId || 0);
    const userId = Number(notes.userId || 0);

    const existing = await this.paymentRepo.findOne({
      where: { gatewayEventId: razorpayPaymentId } as any,
    });
    if (existing) return;

    await AppDataSource.transaction(async (trx) => {
      const invoiceRepo = trx.getRepository(SubscriptionInvoice);
      const paymentRepo = trx.getRepository(SubscriptionPayment);

      let invoice: any = null;

      if (invoiceId) {
        invoice = await invoiceRepo.findOne({ where: { id: invoiceId } as any });
      }

      if (!invoice && razorpayOrderId) {
        invoice = await invoiceRepo.findOne({
          where: { paymentReference: razorpayOrderId } as any,
        });
      }

      if (!invoice) {
        await paymentRepo.save(
          paymentRepo.create({
            invoiceId: null,
            userId: userId || null,
            status: "successful",
            amountCents: Math.round(Number(payment.amount || 0)), 
            currency: String(payment.currency || "INR").toUpperCase(),
            gateway: "razorpay",
            gatewayEventId: razorpayPaymentId,
            gatewayPayload: event,
          } as any)
        );
        return;
      }

      await paymentRepo.save(
        paymentRepo.create({
          invoiceId: invoice.id,
          userId: Number(invoice.userId),
          status: "successful",
          amountCents: Number(invoice.amountCents),
          currency: String(invoice.currency || "INR").toUpperCase(),
          gateway: "razorpay",
          gatewayEventId: razorpayPaymentId,
          gatewayPayload: event,
        } as any)
      );

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

  async handleRazorpayPaymentFailed(event: any) {
    const payment = event?.payload?.payment?.entity;
    if (!payment) return;

    const razorpayPaymentId = payment.id;

    const existing = await this.paymentRepo.findOne({
      where: { gatewayEventId: razorpayPaymentId } as any,
    });
    if (existing) return;

    const notes = payment.notes || {};
    const invoiceId = Number(notes.invoiceId || 0);
    const userId = Number(notes.userId || 0);

    await AppDataSource.transaction(async (trx) => {
      const invoiceRepo = trx.getRepository(SubscriptionInvoice);
      const paymentRepo = trx.getRepository(SubscriptionPayment);

      const invoice = invoiceId
        ? await invoiceRepo.findOne({ where: { id: invoiceId } as any })
        : null;

      await paymentRepo.save(
        paymentRepo.create({
          invoiceId: invoice ? invoice.id : null,
          userId: invoice ? Number(invoice.userId) : userId || null,
          status: "failed",
          amountCents: invoice ? Number(invoice.amountCents) : Math.round(Number(payment.amount || 0)),
          currency: String(payment.currency || "INR").toUpperCase(),
          gateway: "razorpay",
          gatewayEventId: razorpayPaymentId,
          gatewayPayload: event,
        } as any)
      );

      if (invoice) {
        invoice.status = "failed";
        invoice.metadata = { ...(invoice.metadata || {}), source: "webhook_failed" };
        await invoiceRepo.save(invoice);
      }
    });
  }

  async cancelLocalSubscription(userId: number, immediate: boolean) {
    const sub = await this.userSubRepo.findOne({ where: { userId } as any });
    if (!sub) throw { status: 400, message: "No active subscription to cancel" };

    (sub as any).autoRenew = false;

    if (immediate) {
      (sub as any).status = "canceled";
      (sub as any).statusV2 = "canceled";
      (sub as any).canceledAt = new Date();
      (sub as any).endDate = new Date();
      (sub as any).executionEnabled = false;
    } else {
      (sub as any).cancelAt = (sub as any).endDate || new Date();
      (sub as any).canceledAt = new Date();
      (sub as any).statusV2 = "canceled";
    }

    return this.userSubRepo.save(sub);
  }

  private async upsertSubscriptionFromInvoice(trx: any, invoice: any) {
    const userSubRepo = trx.getRepository(UserSubscription);

    const userId = Number(invoice.userId);
    const planId = Number(invoice.planId);

    const existing = await userSubRepo.findOne({ where: { userId } as any });

    const startDate = new Date(invoice.billingPeriodStart);
    const endDate = new Date(invoice.billingPeriodEnd);

    if (existing) {
      const currentEnd = (existing as any).endDate ? new Date((existing as any).endDate) : null;
      if (currentEnd && currentEnd > startDate) {
        (existing as any).startDate = (existing as any).startDate || startDate;
        (existing as any).endDate = endDate > currentEnd ? endDate : currentEnd;
      } else {
        (existing as any).startDate = startDate;
        (existing as any).endDate = endDate;
      }

      (existing as any).planId = planId;
      (existing as any).status = "active";
      (existing as any).statusV2 = "active";
      (existing as any).executionEnabled = true;

      (existing as any).metadata = {
        ...((existing as any).metadata || {}),
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
    } as any);

    return userSubRepo.save(created);
  }

  private computePeriodEnd(start: Date, interval: string) {
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
