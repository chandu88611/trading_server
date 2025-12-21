import AppDataSource from "../../../db/data-source";
import { Repository } from "typeorm";
import {
  SubscriptionInvoice,
  SubscriptionPayment,
  UserSubscription,
  SubscriptionPlan,
} from "../../../entity";
import { User } from "../../../entity";

export class BillingDBService {
  private invoiceRepo: Repository<SubscriptionInvoice>;
  private paymentRepo: Repository<SubscriptionPayment>;
  private userSubRepo: Repository<UserSubscription>;
  private planRepo: Repository<SubscriptionPlan>;
  private userRepo: Repository<User>;

  constructor() {
    this.invoiceRepo = AppDataSource.getRepository(SubscriptionInvoice);
    this.paymentRepo = AppDataSource.getRepository(SubscriptionPayment);
    this.userSubRepo = AppDataSource.getRepository(UserSubscription);
    this.planRepo = AppDataSource.getRepository(SubscriptionPlan);
    this.userRepo = AppDataSource.getRepository(User);
  }

  async getUserSubscriptionEntity(userId: number) {
    return this.userSubRepo.findOne({ where: { userId } });
  }
  async getCurrentSubscription(userId: number) {
    const sub = await this.userSubRepo.findOne({ where: { userId } });
    if (!sub) return null;

    const plan = await this.planRepo.findOne({ where: { id: sub.planId } });

    // You can shape this exactly how UI needs
    return {
      id: sub.id,
      userId: sub.userId,
      planId: sub.planId,
      status: sub.status,
      startDate: sub.startDate,
      endDate: sub.endDate,
      cancelAtPeriodEnd: Boolean(sub?.metadata?.cancel_at_period_end),
      stripeSubscriptionId: this.extractStripeSubscriptionId(sub),
      plan: plan
        ? {
            id: plan.id,
            name: plan.name,
            description: plan.description,
            priceCents: plan.priceCents,
            currency: plan.currency,
            interval: plan.interval,
            isActive: (plan as any).isActive,
            featureFlags: (plan as any).featureFlags, 
            metadata: (plan as any).metadata,
          }
        : null,
    };
  }
  extractStripeSubscriptionId(userSub: UserSubscription): string | null {
    const m: any = userSub?.metadata;

    if (m?.id && typeof m.id === "string" && m.id.startsWith("sub_")) return m.id;

    if (m?.subscription?.id && typeof m.subscription.id === "string") return m.subscription.id;

    if (m?.stripeSubscriptionId && typeof m.stripeSubscriptionId === "string")
      return m.stripeSubscriptionId;

    return null;
  }

  async createInvoiceFromStripe(stripeInvoice: any) {
    const metadata = stripeInvoice?.lines?.data?.[0]?.price?.product?.metadata;
    const planId = metadata?.planId ? Number(metadata.planId) : undefined;
    const userId = stripeInvoice?.metadata?.userId
      ? Number(stripeInvoice.metadata.userId)
      : undefined;

    const invoice = this.invoiceRepo.create({
      subscriptionId: stripeInvoice.subscription ? Number(stripeInvoice.subscription):0,
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

  async upsertPaymentFromStripe(stripeEvent: any, status: string) {
    const gatewayEventId = stripeEvent.id;
    const existing = await this.paymentRepo.findOne({
      where: { gatewayEventId },
    });
    if (existing) return existing;

    const invoiceId = null;
    const userId = stripeEvent.data?.object?.customer_metadata?.userId
      ? Number(stripeEvent.data.object.customer_metadata.userId)
      : undefined;

    const amountCents =
      stripeEvent.data?.object?.amount_paid ?? stripeEvent.data?.object?.amount ?? 0;

    const payment = this.paymentRepo.create({
      invoiceId,
      userId: userId,
      status: status as any,
      amountCents,
      currency: (stripeEvent.data?.object?.currency || "INR").toUpperCase(),
      gateway: "stripe",
      gatewayEventId: gatewayEventId,
      gatewayPayload: stripeEvent,
    });

    return this.paymentRepo.save(payment);
  }

  async updateLocalSubscriptionOnStripeUpdate(stripeSub: any) {
    const planId = stripeSub?.items?.data?.[0]?.price?.product?.metadata?.planId;
    const userId = stripeSub?.metadata?.userId || stripeSub?.customer_metadata?.userId;

    if (!userId || !planId) return null;

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
    } else {
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
