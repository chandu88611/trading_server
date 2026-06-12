import crypto from "crypto";
import { EntityManager, In, LessThan, Repository } from "typeorm";
import AppDataSource from "../../../../db/data-source";
import {
  CrmSyncOutbox,
  SubscriptionInvoice,
  SubscriptionPlan,
  User,
  UserBillingDetails,
  UserSubscription,
} from "../../../../entity";
import { SubscriptionStatus } from "../../../subscriptionPlan/enums/subscriberPlan.enum";

export type CrmLifecycleEventType =
  | "user.registered"
  | "subscription.activated"
  | "subscription.updated"
  | "subscription.canceled"
  | "subscription.expired"
  | "subscription.renewed"
  | "invoice.upserted"
  | "payment.failed";

type UserSnapshot = {
  platformUserId: string;
  name: string | null;
  email: string;
  phone: string | null;
};

type SubscriptionSnapshot = {
  subscriptionId: string;
  planId: string;
  planName: string | null;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  autoRenew: boolean;
  executionEnabled: boolean;
};

type InvoiceSnapshot = {
  tradeInvoiceId: string;
  subscriptionId: string | null;
  planId: string;
  planName: string | null;
  amountCents: number;
  currency: string;
  paymentStatus: string;
  paymentMethod: string | null;
  transactionReference: string | null;
  invoiceDate: string | null;
};

export type CrmLifecycleEnvelope = {
  eventId: string;
  eventType: CrmLifecycleEventType;
  occurredAt: string;
  organizationId: string | null;
  source: "trading_service";
  user: UserSnapshot;
  leadMatchKeys: {
    email: string;
    phone: string | null;
  };
  subscription?: SubscriptionSnapshot;
  invoice?: InvoiceSnapshot;
  billingDetails?: Record<string, any> | null;
};

type EnqueueArgs = {
  eventType: CrmLifecycleEventType;
  userId: number;
  subscriptionId?: number | null;
  invoiceId?: number | null;
  occurredAt?: Date;
};

export class CrmLifecycleSyncService {
  private readonly outboxRepo: Repository<CrmSyncOutbox>;

  constructor() {
    this.outboxRepo = AppDataSource.getRepository(CrmSyncOutbox);
  }

  async ensureSchema() {
    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS crm_sync_outbox (
        id BIGSERIAL PRIMARY KEY,
        event_id VARCHAR(120) NOT NULL UNIQUE,
        event_type VARCHAR(120) NOT NULL,
        organization_id VARCHAR(120),
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        last_attempt_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_crm_sync_outbox_status_created_at
      ON crm_sync_outbox (status, created_at);
    `);
  }

  async enqueueEvent(args: EnqueueArgs, manager?: EntityManager) {
    const envelope = await this.buildEnvelope(args, manager);
    const repo = manager ? manager.getRepository(CrmSyncOutbox) : this.outboxRepo;
    const record = repo.create({
      eventId: envelope.eventId,
      eventType: envelope.eventType,
      organizationId: envelope.organizationId,
      status: "pending",
      payload: envelope as any,
    });
    await repo.save(record);
    return record;
  }

  async syncUserRegistered(userId: number) {
    await this.enqueueEvent({ eventType: "user.registered", userId });
    await this.publishPending(10);
  }

  async dispatchSubscriptionAndInvoiceEvents(args: {
    userId: number;
    subscriptionId: number;
    invoiceId: number;
    subscriptionEventType: Extract<
      CrmLifecycleEventType,
      "subscription.activated" | "subscription.renewed" | "subscription.updated"
    >;
  }) {
    await this.enqueueEvent({
      eventType: "invoice.upserted",
      userId: args.userId,
      subscriptionId: args.subscriptionId,
      invoiceId: args.invoiceId,
    });
    await this.enqueueEvent({
      eventType: args.subscriptionEventType,
      userId: args.userId,
      subscriptionId: args.subscriptionId,
      invoiceId: args.invoiceId,
    });
    await this.publishPending(10);
  }

  async dispatchSubscriptionEvent(args: {
    eventType: Extract<
      CrmLifecycleEventType,
      "subscription.activated" | "subscription.updated" | "subscription.canceled" | "subscription.expired"
    >;
    userId: number;
    subscriptionId?: number | null;
    invoiceId?: number | null;
  }) {
    await this.enqueueEvent({
      eventType: args.eventType,
      userId: args.userId,
      subscriptionId: args.subscriptionId ?? null,
      invoiceId: args.invoiceId ?? null,
    });
    await this.publishPending(10);
  }

  async dispatchPaymentFailure(args: {
    userId: number;
    invoiceId?: number | null;
  }) {
    await this.enqueueEvent({
      eventType: "payment.failed",
      userId: args.userId,
      invoiceId: args.invoiceId ?? null,
    });
    await this.publishPending(10);
  }

  async dispatchSubscriptionCanceled(args: {
    userId: number;
    subscriptionId?: number | null;
  }) {
    await this.enqueueEvent({
      eventType: "subscription.canceled",
      userId: args.userId,
      subscriptionId: args.subscriptionId ?? null,
    });
    await this.publishPending(10);
  }

  async publishPending(limit = 25) {
    if (!this.isConfigured() || !AppDataSource.isInitialized) {
      return;
    }

    const pending = await this.outboxRepo.find({
      where: [
        { status: "pending" as const },
        { status: "failed" as const, attempts: LessThan(10) as any },
      ],
      order: { createdAt: "ASC" },
      take: limit,
    });

    for (const item of pending) {
      await this.publishOutboxItem(item.id);
    }
  }

  async publishOutboxItem(id: number) {
    if (!this.isConfigured() || !AppDataSource.isInitialized) {
      return;
    }

    const item = await this.outboxRepo.findOne({ where: { id } });
    if (!item || item.status === "delivered") {
      return;
    }

    item.status = "processing";
    item.lastAttemptAt = new Date();
    item.attempts += 1;
    await this.outboxRepo.save(item);

    try {
      await this.postEnvelope(item.payload as CrmLifecycleEnvelope);
      item.status = "delivered";
      item.lastError = null;
      item.deliveredAt = new Date();
    } catch (error: any) {
      item.status = "failed";
      item.lastError = error?.message || String(error);
    }

    await this.outboxRepo.save(item);
  }

  async reconcileExpiredSubscriptions(now = new Date()) {
    if (!AppDataSource.isInitialized) {
      return [];
    }

    return AppDataSource.transaction(async (manager) => {
      const repo = manager.getRepository(UserSubscription);
      const expired = await repo.find({
        where: {
          statusV2: SubscriptionStatus.ACTIVE,
          endDate: LessThan(now),
        } as any,
        take: 100,
      });

      const changed: UserSubscription[] = [];
      for (const sub of expired) {
        if (!sub.executionEnabled) {
          continue;
        }
        sub.status = SubscriptionStatus.EXPIRED;
        sub.statusV2 = SubscriptionStatus.EXPIRED;
        sub.executionEnabled = false;
        await repo.save(sub);
        changed.push(sub);
        await this.enqueueEvent(
          {
            eventType: "subscription.expired",
            userId: Number((sub as any).userId),
            subscriptionId: Number((sub as any).id),
            occurredAt: now,
          },
          manager
        );
      }

      return changed;
    });
  }

  private isConfigured() {
    return Boolean(this.getBaseUrl() && this.getApiSecret());
  }

  private getBaseUrl() {
    return String(process.env.CRM_BASE_URL || "").trim().replace(/\/$/, "");
  }

  private getApiSecret() {
    return String(
      process.env.CRM_INTEGRATION_SECRET ||
        process.env.CRM_CONVERSION_SECRET ||
        process.env.CRM_API_SECRET ||
        ""
    ).trim();
  }

  private async postEnvelope(envelope: CrmLifecycleEnvelope) {
    const timeoutMs = Number(process.env.CRM_TIMEOUT_MS ?? 8_000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(
        `${this.getBaseUrl()}/api/integrations/trading/events`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-secret": this.getApiSecret(),
          },
          body: JSON.stringify(envelope),
          signal: controller.signal,
        },
      );
    } catch (err: any) {
      const isTimeout = err?.name === "AbortError" || String(err?.message ?? "").includes("abort");
      throw new Error(isTimeout ? `CRM sync timed out after ${timeoutMs}ms` : `CRM sync network error: ${err?.message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      throw new Error(`CRM sync failed (${response.status}): ${body}`);
    }
  }

  private async buildEnvelope(
    args: EnqueueArgs,
    manager?: EntityManager
  ): Promise<CrmLifecycleEnvelope> {
    const repo = manager ?? AppDataSource.manager;
    const user = await repo.getRepository(User).findOne({
      where: { id: args.userId },
    });
    if (!user) {
      throw new Error(`crm_sync_user_not_found:${args.userId}`);
    }

    const billing = await repo.getRepository(UserBillingDetails).findOne({
      where: { userId: String(args.userId) },
    });

    const subscription = args.subscriptionId
      ? await repo.getRepository(UserSubscription).findOne({
          where: { id: args.subscriptionId } as any,
        })
      : await repo.getRepository(UserSubscription).findOne({
          where: { userId: args.userId } as any,
          order: { updatedAt: "DESC" } as any,
        });

    const invoice = args.invoiceId
      ? await repo.getRepository(SubscriptionInvoice).findOne({
          where: { id: args.invoiceId } as any,
        })
      : null;

    const planIds = [invoice?.planId, subscription?.planId]
      .map((value) => Number(value || 0))
      .filter((value) => value > 0);

    const plans = planIds.length
      ? await repo.getRepository(SubscriptionPlan).find({
          where: { id: In(planIds) } as any,
        })
      : [];
    const planMap = new Map(plans.map((plan) => [Number(plan.id), plan]));

    const userSnapshot: UserSnapshot = {
      platformUserId: String(user.id),
      name: user.name ?? null,
      email: user.email,
      phone: null,
    };

    const envelope: CrmLifecycleEnvelope = {
      eventId: crypto.randomUUID(),
      eventType: args.eventType,
      occurredAt: (args.occurredAt || new Date()).toISOString(),
      organizationId:
        String(process.env.CRM_DEFAULT_ORGANIZATION_ID || "").trim() || null,
      source: "trading_service",
      user: userSnapshot,
      leadMatchKeys: {
        email: user.email,
        phone: null,
      },
      billingDetails: billing
        ? {
            panNumber: billing.panNumber ?? null,
            accountHolderName: billing.accountHolderName ?? null,
            bankName: billing.bankName ?? null,
            branch: billing.branch ?? null,
            addressLine1: billing.addressLine1 ?? null,
            addressLine2: billing.addressLine2 ?? null,
            city: billing.city ?? null,
            state: billing.state ?? null,
            pincode: billing.pincode ?? null,
          }
        : null,
    };

    if (subscription) {
      const plan = planMap.get(Number(subscription.planId));
      envelope.subscription = {
        subscriptionId: String((subscription as any).id),
        planId: String(subscription.planId),
        planName: plan?.name ?? null,
        status: subscription.statusV2 ?? null,
        startDate: subscription.startDate ? subscription.startDate.toISOString() : null,
        endDate: subscription.endDate ? subscription.endDate.toISOString() : null,
        autoRenew: Boolean(subscription.autoRenew),
        executionEnabled: Boolean(subscription.executionEnabled),
      };
    }

    if (invoice) {
      const plan = planMap.get(Number(invoice.planId));
      envelope.invoice = {
        tradeInvoiceId: String(invoice.id),
        subscriptionId:
          invoice.subscriptionId === null || invoice.subscriptionId === undefined
            ? null
            : String(invoice.subscriptionId),
        planId: String(invoice.planId),
        planName: plan?.name ?? null,
        amountCents: Number(invoice.amountCents),
        currency: String(invoice.currency || "INR"),
        paymentStatus: this.mapInvoiceStatus(invoice.status),
        paymentMethod: invoice.paymentGateway ?? null,
        transactionReference: invoice.paymentReference ?? null,
        invoiceDate: invoice.createdAt ? invoice.createdAt.toISOString() : null,
      };
    }

    return envelope;
  }

  private mapInvoiceStatus(status: string) {
    switch (String(status || "").toLowerCase()) {
      case "paid":
        return "paid";
      case "failed":
        return "failed";
      case "refunded":
        return "refunded";
      default:
        return "pending";
    }
  }
}
