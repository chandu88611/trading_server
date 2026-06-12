import AppDataSource from "../../../db/data-source";
import { DeepPartial, EntityManager, Repository } from "typeorm";
import {
  ReferralRewardCredit,
  SubscriptionInvoice,
  SubscriptionPayment,
  SubscriptionPlan,
  User,
  UserBillingDetails,
  UserSubscription,
  WithdrawalRequest,
  WithdrawalSetting,
} from "../../../entity";
import { RazorpayOrder } from "../../../entity/RazorpayOrder";
import { WithdrawalRequestStatus } from "../../../entity/WithdrawalRequest";
import { HttpStatusCode } from "../../../types/constants";
import {
  AdminWithdrawalListItem,
  BillingWalletSummary,
  UserWithdrawalListItem,
  WithdrawalSettingsResponse,
} from "../interfaces/billing.interface";
import { CrmLifecycleSyncService } from "../../integrations/crm/services/crmLifecycleSync.service";
import { UserSubscriptionDBService } from "../../userSubscription/services/userSubscription.db";
import { SubscriptionStatus } from "../../subscriptionPlan/enums/subscriberPlan.enum";
import { selectUnavailablePlanStrategyForNewSubscription } from "../../subscriptionPlan/utils/planStrategy";
import { RazorpayService } from "./razorpay.service";
import { RazorpayXService } from "./razorpayx.service";

type CheckoutCreateResult = {
  invoiceId: number;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
};

type PaymentFinalizationResult = {
  invoice: SubscriptionInvoice | null;
  subscription: UserSubscription | null;
  subscriptionEventType: "subscription.activated" | "subscription.renewed" | null;
  invoiceTransitionedToPaid: boolean;
};

const LOCKED_WITHDRAWAL_STATUSES: WithdrawalRequestStatus[] = [
  "requested",
  "approved",
  "processing",
  "queued",
];

export class BillingDBService {
  private paymentRepo: Repository<SubscriptionPayment>;
  private invoiceRepo: Repository<SubscriptionInvoice>;
  private userSubRepo: Repository<UserSubscription>;
  private planRepo: Repository<SubscriptionPlan>;
  private withdrawalRepo: Repository<WithdrawalRequest>;
  private withdrawalSettingRepo: Repository<WithdrawalSetting>;
  private razorpay: RazorpayService;
  private razorpayX: RazorpayXService;
  private crmSync: CrmLifecycleSyncService;
  private userSubscriptionDb: UserSubscriptionDBService;

  constructor() {
    this.paymentRepo = AppDataSource.getRepository(SubscriptionPayment);
    this.invoiceRepo = AppDataSource.getRepository(SubscriptionInvoice);
    this.userSubRepo = AppDataSource.getRepository(UserSubscription);
    this.planRepo = AppDataSource.getRepository(SubscriptionPlan);
    this.withdrawalRepo = AppDataSource.getRepository(WithdrawalRequest);
    this.withdrawalSettingRepo = AppDataSource.getRepository(WithdrawalSetting);
    this.razorpay = new RazorpayService();
    this.razorpayX = new RazorpayXService();
    this.crmSync = new CrmLifecycleSyncService();
    this.userSubscriptionDb = new UserSubscriptionDBService();
  }

  private getManager(manager?: EntityManager) {
    return manager ?? this.invoiceRepo.manager;
  }

  private async assertPlanStrategyAvailableForNewSubscription(
    manager: EntityManager,
    planId: number
  ) {
    const plan = await manager.getRepository(SubscriptionPlan).findOne({
      where: { id: planId } as any,
      relations: { planStrategies: { strategy: true } } as any,
    });

    if (!plan) {
      throw {
        statusCode: HttpStatusCode._NOT_FOUND,
        message: "Plan not found",
      };
    }

    if (selectUnavailablePlanStrategyForNewSubscription(plan.planStrategies as any)) {
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: "strategy_unavailable_for_new_subscription",
      };
    }
  }

  private parseAmount(value: unknown): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private roundInr(amount: number): number {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }

  private toPaise(amountInr: number): number {
    return Math.round(this.roundInr(amountInr) * 100);
  }

  private getEnvNumber(name: string, fallback: number): number {
    const raw = String(process.env[name] ?? "").trim();
    if (!raw) return fallback;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;

    return parsed;
  }

  private getRewardAmountInr(level: 1 | 2): number {
    const envName =
      level === 1 ? "REFERRAL_LEVEL1_REWARD_INR" : "REFERRAL_LEVEL2_REWARD_INR";
    const amount = this.getEnvNumber(envName, 0);
    return amount > 0 ? this.roundInr(amount) : 0;
  }

  private getRewardHoldDays(): number {
    const holdDays = Math.floor(this.getEnvNumber("REFERRAL_REWARD_HOLD_DAYS", 7));
    return holdDays >= 0 ? holdDays : 7;
  }

  private getDefaultMinWithdrawalAmountInr(): number {
    const amount = this.getEnvNumber("DEFAULT_MIN_WITHDRAWAL_INR", 500);
    return amount > 0 ? this.roundInr(amount) : 500;
  }

  private addDays(base: Date, days: number): Date {
    const next = new Date(base);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  private requireSourceAccountNumber(): string {
    const accountNumber = String(
      process.env.RAZORPAYX_SOURCE_ACCOUNT_NUMBER ?? ""
    ).trim();

    if (!accountNumber) {
      throw new Error("razorpayx_source_account_number_missing");
    }

    return accountNumber;
  }

  private mapWithdrawalStatus(status: string | null | undefined): WithdrawalRequestStatus {
    switch (String(status || "").toLowerCase()) {
      case "queued":
        return "queued";
      case "processed":
        return "processed";
      case "rejected":
        return "rejected";
      case "failed":
      case "cancelled":
      case "canceled":
        return "failed";
      case "reversed":
        return "reversed";
      case "requested":
        return "requested";
      case "approved":
        return "approved";
      case "processing":
      case "pending":
      default:
        return "processing";
    }
  }

  private applyWithdrawalStatus(
    request: WithdrawalRequest,
    nextStatus: WithdrawalRequestStatus,
    timestamp: Date
  ) {
    request.status = nextStatus;

    if (nextStatus === "approved") request.approvedAt = request.approvedAt ?? timestamp;
    if (nextStatus === "queued") request.queuedAt = request.queuedAt ?? timestamp;
    if (nextStatus === "processed") request.processedAt = request.processedAt ?? timestamp;
    if (nextStatus === "rejected") request.rejectedAt = request.rejectedAt ?? timestamp;
    if (nextStatus === "failed") request.failedAt = request.failedAt ?? timestamp;
    if (nextStatus === "reversed") request.reversedAt = request.reversedAt ?? timestamp;
  }

  private mapWithdrawalRequest(request: WithdrawalRequest): UserWithdrawalListItem {
    return {
      id: Number(request.id),
      amountInr: this.parseAmount(request.amountInr),
      status: request.status,
      adminReviewNotes: request.adminReviewNotes ?? null,
      failureCode: request.failureCode ?? null,
      failureDescription: request.failureDescription ?? null,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      approvedAt: request.approvedAt ?? null,
      rejectedAt: request.rejectedAt ?? null,
      queuedAt: request.queuedAt ?? null,
      processedAt: request.processedAt ?? null,
      failedAt: request.failedAt ?? null,
      reversedAt: request.reversedAt ?? null,
    };
  }

  private mapAdminWithdrawalRequest(
    request: WithdrawalRequest & { user?: User | null }
  ): AdminWithdrawalListItem {
    return {
      ...this.mapWithdrawalRequest(request),
      user: {
        id: Number(request.user?.id ?? 0),
        email: request.user?.email ?? "",
        name: request.user?.name ?? null,
      },
    };
  }

  private async getWithdrawalSettingsRecord(
    manager?: EntityManager
  ): Promise<WithdrawalSetting> {
    const repo = this.getManager(manager).getRepository(WithdrawalSetting);
    let settings = await repo.findOne({ where: { id: 1 } as any });

    if (!settings) {
      settings = repo.create({
        id: 1,
        minWithdrawalAmountInr: String(this.getDefaultMinWithdrawalAmountInr()),
      });
      settings = await repo.save(settings);
    }

    return settings;
  }

  private async getBillingDetailsForPayout(
    userId: number,
    manager?: EntityManager
  ): Promise<UserBillingDetails | null> {
    return this.getManager(manager)
      .getRepository(UserBillingDetails)
      .findOne({ where: { userId: String(userId) } as any });
  }

  private assertBillingDetailsReadyForPayout(
    billingDetails: UserBillingDetails | null
  ): asserts billingDetails is UserBillingDetails {
    if (!billingDetails) {
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: "billing_details_required",
      };
    }

    const requiredFields = [
      billingDetails.accountHolderName,
      billingDetails.accountNumber,
      billingDetails.ifscCode,
      billingDetails.bankName,
    ].map((value) => String(value ?? "").trim());

    if (requiredFields.some((value) => value.length === 0)) {
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: "billing_details_incomplete",
      };
    }

    if (String(billingDetails.accountHolderName ?? "").trim().length < 3) {
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: "billing_details_incomplete",
      };
    }
  }

  private async updateRazorpayOrderStatus(
    razorpayOrderId: string | null | undefined,
    status: string,
    manager?: EntityManager
  ): Promise<void> {
    if (!razorpayOrderId) return;

    await this.getManager(manager)
      .getRepository(RazorpayOrder)
      .createQueryBuilder()
      .update(RazorpayOrder)
      .set({ status: status as any })
      .where("razorpay_order_id = :razorpayOrderId", { razorpayOrderId })
      .execute();
  }

  private async findInvoiceForPayment(
    manager: EntityManager,
    args: { invoiceId?: number | null; razorpayOrderId?: string | null }
  ): Promise<SubscriptionInvoice | null> {
    const invoiceRepo = manager.getRepository(SubscriptionInvoice);

    if (args.invoiceId) {
      const byId = await invoiceRepo.findOne({ where: { id: args.invoiceId } as any });
      if (byId) return byId;
    }

    if (args.razorpayOrderId) {
      const orderRow = await manager.getRepository(RazorpayOrder).findOne({
        where: { razorpayOrderId: args.razorpayOrderId } as any,
      });

      if (orderRow?.invoiceId) {
        const byOrderLink = await invoiceRepo.findOne({
          where: { id: Number(orderRow.invoiceId) } as any,
        });
        if (byOrderLink) return byOrderLink;
      }

      const byReference = await invoiceRepo.findOne({
        where: { paymentReference: args.razorpayOrderId } as any,
      });

      if (byReference) return byReference;
    }

    return null;
  }

  private async getSubscriptionForInvoice(
    manager: EntityManager,
    invoice: SubscriptionInvoice
  ): Promise<UserSubscription | null> {
    const repo = manager.getRepository(UserSubscription);

    if (invoice.subscriptionId) {
      const byId = await repo.findOne({ where: { id: invoice.subscriptionId } as any });
      if (byId) return byId;
    }

    return repo.findOne({
      where: {
        userId: Number(invoice.userId),
        planId: Number(invoice.planId),
        statusV2: SubscriptionStatus.ACTIVE as any,
      } as any,
      order: { createdAt: "DESC" } as any,
    });
  }

  private async recordSuccessfulPayment(
    manager: EntityManager,
    invoice: SubscriptionInvoice | null,
    args: {
      fallbackUserId?: number | null;
      razorpayPaymentId: string;
      gatewayPayload: any;
      amountPaise?: number | null;
      currency?: string | null;
    }
  ) {
    const paymentRepo = manager.getRepository(SubscriptionPayment);
    const fallbackUserId = Number(args.fallbackUserId || 0);
    const existing = await paymentRepo.findOne({
      where: { gatewayEventId: args.razorpayPaymentId } as any,
    });

    if (existing) {
      return existing;
    }

    if (!invoice && fallbackUserId <= 0) {
      return null;
    }

    return paymentRepo.save(
      paymentRepo.create({
        invoiceId: invoice ? Number(invoice.id) : null,
        userId: invoice ? Number(invoice.userId) : fallbackUserId,
        status: "successful",
        amountCents: invoice
          ? Number(invoice.amountCents)
          : Math.round(Number(args.amountPaise || 0)),
        currency: String(invoice?.currency || args.currency || "INR").toUpperCase(),
        gateway: "razorpay",
        gatewayEventId: args.razorpayPaymentId,
        gatewayPayload: args.gatewayPayload,
      } as any)
    );
  }

  private async awardReferralRewardsForFirstPaidInvoice(
    manager: EntityManager,
    invoice: SubscriptionInvoice
  ): Promise<void> {
    const existingPaidInvoiceCount = await manager
      .getRepository(SubscriptionInvoice)
      .createQueryBuilder("invoice")
      .where("invoice.user_id = :userId", { userId: Number(invoice.userId) })
      .andWhere("invoice.status = :status", { status: "paid" })
      .andWhere("invoice.id != :invoiceId", { invoiceId: Number(invoice.id) })
      .getCount();

    if (existingPaidInvoiceCount > 0) {
      return;
    }

    const rewardedUser = await manager.getRepository(User).findOne({
      where: { id: Number(invoice.userId) } as any,
    });

    if (!rewardedUser || rewardedUser.deletedAt) {
      return;
    }

    const rewardCredits: Array<DeepPartial<ReferralRewardCredit>> = [];
    const earnedAt = new Date();
    const availableAt = this.addDays(earnedAt, this.getRewardHoldDays());

    let currentReferrerId = rewardedUser.referredByUserId;

    for (const level of [1, 2] as const) {
      if (!currentReferrerId) break;

      const beneficiary = await manager.getRepository(User).findOne({
        where: { id: Number(currentReferrerId) } as any,
      });

      if (!beneficiary || beneficiary.deletedAt) {
        break;
      }

      const amountInr = this.getRewardAmountInr(level);
      if (amountInr > 0) {
        rewardCredits.push({
          sourceInvoiceId: String(invoice.id),
          rewardedUserId: String(invoice.userId),
          beneficiaryUserId: String(beneficiary.id),
          level,
          amountInr: String(amountInr),
          earnedAt,
          availableAt,
        });
      }

      currentReferrerId = beneficiary.referredByUserId;
    }

    if (!rewardCredits.length) {
      return;
    }

    await manager
      .getRepository(ReferralRewardCredit)
      .createQueryBuilder()
      .insert()
      .values(rewardCredits)
      .orIgnore()
      .execute();
  }

  private async finalizeSuccessfulPayment(
    manager: EntityManager,
    args: {
      userId?: number | null;
      invoiceId?: number | null;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      gatewayPayload: any;
      source: string;
      amountPaise?: number | null;
      currency?: string | null;
      enforceOwnership?: boolean;
    }
  ): Promise<PaymentFinalizationResult> {
    const invoice = await this.findInvoiceForPayment(manager, {
      invoiceId: args.invoiceId ?? null,
      razorpayOrderId: args.razorpayOrderId,
    });

    await this.recordSuccessfulPayment(manager, invoice, {
      fallbackUserId: args.userId ?? null,
      razorpayPaymentId: args.razorpayPaymentId,
      gatewayPayload: args.gatewayPayload,
      amountPaise: args.amountPaise ?? null,
      currency: args.currency ?? null,
    });

    await this.updateRazorpayOrderStatus(args.razorpayOrderId, "paid", manager);

    if (!invoice) {
      return {
        invoice: null,
        subscription: null,
        subscriptionEventType: null,
        invoiceTransitionedToPaid: false,
      };
    }

    if (
      args.enforceOwnership &&
      args.userId &&
      Number(invoice.userId) !== Number(args.userId)
    ) {
      throw {
        statusCode: HttpStatusCode._UNAUTHORISED,
        message: "invoice_not_owned_by_user",
      };
    }

    const invoiceRepo = manager.getRepository(SubscriptionInvoice);
    const alreadyPaid = invoice.status === "paid";

    invoice.paymentGateway = "razorpay";
    invoice.paymentReference = args.razorpayOrderId || invoice.paymentReference;
    invoice.metadata = {
      ...(invoice.metadata || {}),
      razorpay_payment_id: args.razorpayPaymentId,
      razorpay_order_id: args.razorpayOrderId,
      source: args.source,
    };

    if (!alreadyPaid) {
      invoice.status = "paid";
    }

    const savedInvoice = await invoiceRepo.save(invoice);

    if (alreadyPaid) {
      return {
        invoice: savedInvoice,
        subscription: await this.getSubscriptionForInvoice(manager, savedInvoice),
        subscriptionEventType: null,
        invoiceTransitionedToPaid: false,
      };
    }

    const updatedSub = await this.upsertSubscriptionFromInvoice(manager, savedInvoice);
    if (savedInvoice.subscriptionId !== Number(updatedSub.subscription.id)) {
      savedInvoice.subscriptionId = Number(updatedSub.subscription.id);
      await invoiceRepo.save(savedInvoice);
    }

    await this.awardReferralRewardsForFirstPaidInvoice(manager, savedInvoice);

    return {
      invoice: savedInvoice,
      subscription: updatedSub.subscription,
      subscriptionEventType: updatedSub.subscriptionEventType,
      invoiceTransitionedToPaid: true,
    };
  }

  private async dispatchPaidInvoiceEvents(result: PaymentFinalizationResult) {
    if (!result.invoiceTransitionedToPaid || !result.invoice || !result.subscription) {
      return;
    }

    await this.crmSync.dispatchSubscriptionAndInvoiceEvents({
      userId: Number(result.invoice.userId),
      subscriptionId: Number(result.subscription.id),
      invoiceId: Number(result.invoice.id),
      subscriptionEventType: result.subscriptionEventType || "subscription.renewed",
    });
  }

  async ensureSchema(): Promise<void> {
    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS razorpay_orders (
        id BIGSERIAL PRIMARY KEY,
        invoice_id BIGINT NOT NULL REFERENCES subscription_invoices(id) ON DELETE CASCADE,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        razorpay_order_id TEXT NOT NULL UNIQUE,
        receipt TEXT,
        amount_cents INT NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'INR',
        status TEXT NOT NULL DEFAULT 'created',
        notes JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_razorpay_orders_invoice_id
      ON razorpay_orders (invoice_id);
    `);

    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_razorpay_orders_user_id
      ON razorpay_orders (user_id);
    `);

    await AppDataSource.query(`
      ALTER TABLE subscription_invoices
      ALTER COLUMN subscription_id DROP NOT NULL;
    `);

    await AppDataSource.query(`
      ALTER TABLE user_billing_details
      ADD COLUMN IF NOT EXISTS razorpay_contact_id TEXT;
    `);

    await AppDataSource.query(`
      ALTER TABLE user_billing_details
      ADD COLUMN IF NOT EXISTS razorpay_fund_account_id TEXT;
    `);

    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS referral_reward_credits (
        id BIGSERIAL PRIMARY KEY,
        source_invoice_id BIGINT NOT NULL REFERENCES subscription_invoices(id) ON DELETE CASCADE,
        rewarded_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        beneficiary_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        level INT NOT NULL,
        amount_inr NUMERIC(15, 2) NOT NULL,
        earned_at TIMESTAMPTZ NOT NULL,
        available_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await AppDataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_reward_credit_source_beneficiary_level
      ON referral_reward_credits (source_invoice_id, beneficiary_user_id, level);
    `);

    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_referral_reward_credits_beneficiary_user_id
      ON referral_reward_credits (beneficiary_user_id);
    `);

    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_referral_reward_credits_rewarded_user_id
      ON referral_reward_credits (rewarded_user_id);
    `);

    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount_inr NUMERIC(15, 2) NOT NULL,
        status TEXT NOT NULL DEFAULT 'requested',
        admin_reviewed_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        admin_review_notes TEXT,
        admin_reviewed_at TIMESTAMPTZ,
        approved_at TIMESTAMPTZ,
        rejected_at TIMESTAMPTZ,
        queued_at TIMESTAMPTZ,
        processed_at TIMESTAMPTZ,
        failed_at TIMESTAMPTZ,
        reversed_at TIMESTAMPTZ,
        razorpay_contact_id TEXT,
        razorpay_fund_account_id TEXT,
        razorpay_payout_id TEXT,
        razorpay_payout_status TEXT,
        payout_idempotency_key TEXT,
        status_details JSONB,
        failure_code TEXT,
        failure_description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id
      ON withdrawal_requests (user_id);
    `);

    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status
      ON withdrawal_requests (status);
    `);

    await AppDataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_withdrawal_requests_razorpay_payout_id_nonnull
      ON withdrawal_requests (razorpay_payout_id)
      WHERE razorpay_payout_id IS NOT NULL;
    `);

    await AppDataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_withdrawal_requests_payout_idempotency_key_nonnull
      ON withdrawal_requests (payout_idempotency_key)
      WHERE payout_idempotency_key IS NOT NULL;
    `);

    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS withdrawal_settings (
        id INT PRIMARY KEY,
        min_withdrawal_amount_inr NUMERIC(15, 2) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await AppDataSource.query(
      `
        INSERT INTO withdrawal_settings (id, min_withdrawal_amount_inr)
        VALUES (1, $1)
        ON CONFLICT (id) DO NOTHING;
      `,
      [String(this.getDefaultMinWithdrawalAmountInr())]
    );
  }

  async getUserSubscriptionEntity(userId: number) {
    return this.userSubRepo.findOne({
      where: { userId, statusV2: SubscriptionStatus.ACTIVE as any } as any,
      order: { createdAt: "DESC" } as any,
    });
  }

  async getCurrentSubscription(userId: number) {
    const sub = await this.userSubRepo.findOne({
      where: { userId, statusV2: SubscriptionStatus.ACTIVE as any } as any,
      order: { createdAt: "DESC" } as any,
    });
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

  async createRazorpayCheckout(
    userId: number,
    plan: SubscriptionPlan
  ): Promise<CheckoutCreateResult> {
    const planPricing = (plan as any).pricing ?? null;
    const currency = String(
      planPricing?.currency || (plan as any).currency || "INR"
    ).toUpperCase();
    const legacySubunitAmount = Math.round(Number((plan as any).priceCents || 0));
    const pricingAmountInr = Number(planPricing?.priceInr ?? NaN);
    const amountPaise = Number.isFinite(pricingAmountInr)
      ? Math.round(pricingAmountInr * 100)
      : legacySubunitAmount;
    const interval = String(planPricing?.interval || (plan as any).interval || "monthly");

    if (!Number.isFinite(amountPaise) || amountPaise < 100) {
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: "invalid_plan_pricing",
      };
    }

    const now = new Date();
    const billingPeriodStart = now;
    const billingPeriodEnd = this.computePeriodEnd(now, interval);

    return AppDataSource.transaction(async (trx) => {
      const invoiceRepo = trx.getRepository(SubscriptionInvoice);
      const orderRepo = trx.getRepository(RazorpayOrder);
      const planId = Number((plan as any).id);
      const existingActiveSubscription = await trx
        .getRepository(UserSubscription)
        .findOne({
          where: {
            userId,
            planId,
            statusV2: SubscriptionStatus.ACTIVE,
          } as any,
        });
      if (!existingActiveSubscription) {
        await this.assertPlanStrategyAvailableForNewSubscription(trx, planId);
      }

      const invoice = invoiceRepo.create({
        subscriptionId: null,
        userId,
        planId,
        amountCents: amountPaise,
        currency,
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

      await orderRepo.save(
        orderRepo.create({
          invoiceId: String(savedInvoice.id),
          userId: String(userId),
          razorpayOrderId: order.id,
          receipt: order.receipt || null,
          amountCents: amountPaise,
          currency,
          status: (order.status || "created") as any,
          notes: order.notes || {},
        })
      );

      savedInvoice.paymentReference = order.id;
      savedInvoice.metadata = {
        ...(savedInvoice.metadata || {}),
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
    const result = await AppDataSource.transaction(async (trx) =>
      this.finalizeSuccessfulPayment(trx, {
        userId: args.userId,
        invoiceId: args.invoiceId,
        razorpayOrderId: args.razorpayOrderId,
        razorpayPaymentId: args.razorpayPaymentId,
        gatewayPayload: args.gatewayPayload,
        source: "client_verify",
        enforceOwnership: true,
      })
    );

    await this.dispatchPaidInvoiceEvents(result);

    return {
      invoice: result.invoice,
      subscription: result.subscription,
    };
  }

  async handleRazorpayPaymentCaptured(event: any) {
    const payment = event?.payload?.payment?.entity;
    if (!payment) return;

    const notes = payment.notes || {};
    const result = await AppDataSource.transaction(async (trx) =>
      this.finalizeSuccessfulPayment(trx, {
        userId: Number(notes.userId || 0) || null,
        invoiceId: Number(notes.invoiceId || 0) || null,
        razorpayOrderId: String(payment.order_id || ""),
        razorpayPaymentId: String(payment.id || ""),
        gatewayPayload: event,
        source: "webhook_payment_captured",
        amountPaise: Number(payment.amount || 0),
        currency: String(payment.currency || "INR"),
      })
    );

    await this.dispatchPaidInvoiceEvents(result);
  }

  async handleRazorpayOrderPaid(event: any) {
    const order = event?.payload?.order?.entity;
    const payment = event?.payload?.payment?.entity;
    const razorpayOrderId = String(payment?.order_id || order?.id || "");

    await this.updateRazorpayOrderStatus(razorpayOrderId, "paid");

    if (!payment?.id) {
      return;
    }

    const notes = payment.notes || order?.notes || {};
    const result = await AppDataSource.transaction(async (trx) =>
      this.finalizeSuccessfulPayment(trx, {
        userId: Number(notes.userId || 0) || null,
        invoiceId: Number(notes.invoiceId || 0) || null,
        razorpayOrderId,
        razorpayPaymentId: String(payment.id),
        gatewayPayload: event,
        source: "webhook_order_paid",
        amountPaise: Number(payment.amount || 0),
        currency: String(payment.currency || "INR"),
      })
    );

    await this.dispatchPaidInvoiceEvents(result);
  }

  async handleRazorpayPaymentFailed(event: any) {
    const payment = event?.payload?.payment?.entity;
    if (!payment) return;

    const razorpayPaymentId = String(payment.id || "");
    const existing = await this.paymentRepo.findOne({
      where: { gatewayEventId: razorpayPaymentId } as any,
    });
    if (existing) {
      await this.updateRazorpayOrderStatus(String(payment.order_id || ""), "failed");
      return;
    }

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
          invoiceId: invoice ? Number(invoice.id) : null,
          userId: invoice ? Number(invoice.userId) : userId || null,
          status: "failed",
          amountCents: invoice
            ? Number(invoice.amountCents)
            : Math.round(Number(payment.amount || 0)),
          currency: String(invoice?.currency || payment.currency || "INR").toUpperCase(),
          gateway: "razorpay",
          gatewayEventId: razorpayPaymentId,
          gatewayPayload: event,
        } as any)
      );

      if (invoice) {
        invoice.status = "failed";
        invoice.metadata = {
          ...(invoice.metadata || {}),
          razorpay_payment_id: razorpayPaymentId,
          razorpay_order_id: String(payment.order_id || ""),
          source: "webhook_failed",
        };
        await invoiceRepo.save(invoice);
      }

      await this.updateRazorpayOrderStatus(String(payment.order_id || ""), "failed", trx);
    });

    await this.crmSync.dispatchPaymentFailure({
      userId,
      invoiceId: invoiceId || null,
    });
  }

  async cancelLocalSubscription(userId: number, immediate: boolean) {
    const sub = await this.userSubRepo.findOne({
      where: { userId, statusV2: SubscriptionStatus.ACTIVE as any } as any,
      order: { createdAt: "DESC" } as any,
    });
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
      (sub as any).status = "canceled";
      (sub as any).statusV2 = "canceled";
      (sub as any).executionEnabled = false;
    }

    const saved = await this.userSubRepo.save(sub);
    await this.userSubscriptionDb.stopStrategyInstancesForSubscription(
      Number((saved as any).id)
    );
    await this.crmSync.dispatchSubscriptionCanceled({
      userId,
      subscriptionId: Number((saved as any).id),
    });
    return saved;
  }

  async getWalletSummary(
    userId: number,
    manager?: EntityManager
  ): Promise<BillingWalletSummary> {
    const rewardCredits = await this.getManager(manager)
      .getRepository(ReferralRewardCredit)
      .find({
        where: { beneficiaryUserId: String(userId) } as any,
      });

    const withdrawals = await this.getManager(manager)
      .getRepository(WithdrawalRequest)
      .find({
        where: { userId: String(userId) } as any,
      });

    const now = new Date();
    const settings = await this.getWithdrawalSettingsRecord(manager);

    const totalEarned = rewardCredits.reduce(
      (sum, credit) => sum + this.parseAmount(credit.amountInr),
      0
    );
    const pendingRewards = rewardCredits.reduce((sum, credit) => {
      return credit.availableAt > now
        ? sum + this.parseAmount(credit.amountInr)
        : sum;
    }, 0);
    const availableRewards = this.roundInr(totalEarned - pendingRewards);
    const lockedWithdrawalAmount = withdrawals.reduce((sum, request) => {
      return LOCKED_WITHDRAWAL_STATUSES.includes(request.status)
        ? sum + this.parseAmount(request.amountInr)
        : sum;
    }, 0);
    const totalWithdrawn = withdrawals.reduce((sum, request) => {
      return request.status === "processed"
        ? sum + this.parseAmount(request.amountInr)
        : sum;
    }, 0);

    return {
      currency: "INR",
      totalEarned: this.roundInr(totalEarned),
      pendingRewards: this.roundInr(pendingRewards),
      withdrawableAmount: Math.max(
        0,
        this.roundInr(availableRewards - lockedWithdrawalAmount - totalWithdrawn)
      ),
      lockedWithdrawalAmount: this.roundInr(lockedWithdrawalAmount),
      totalWithdrawn: this.roundInr(totalWithdrawn),
      minWithdrawalAmount: this.roundInr(
        this.parseAmount(settings.minWithdrawalAmountInr)
      ),
      holdDays: this.getRewardHoldDays(),
    };
  }

  async listWithdrawals(userId: number): Promise<UserWithdrawalListItem[]> {
    const requests = await this.withdrawalRepo.find({
      where: { userId: String(userId) } as any,
      order: { createdAt: "DESC" } as any,
    });

    return requests.map((request) => this.mapWithdrawalRequest(request));
  }

  async listAdminWithdrawals(): Promise<AdminWithdrawalListItem[]> {
    const requests = await this.withdrawalRepo.find({
      relations: { user: true } as any,
      order: { createdAt: "DESC" } as any,
    });

    return requests.map((request) => this.mapAdminWithdrawalRequest(request));
  }

  async getWithdrawalSettings(): Promise<WithdrawalSettingsResponse> {
    const settings = await this.getWithdrawalSettingsRecord();

    return {
      minWithdrawalAmountInr: this.roundInr(
        this.parseAmount(settings.minWithdrawalAmountInr)
      ),
      holdDays: this.getRewardHoldDays(),
    };
  }

  async updateWithdrawalSettings(
    minWithdrawalAmountInr: number
  ): Promise<WithdrawalSettingsResponse> {
    const normalizedAmount = this.roundInr(minWithdrawalAmountInr);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: "invalid_min_withdrawal_amount",
      };
    }

    const settings = await this.getWithdrawalSettingsRecord();
    settings.minWithdrawalAmountInr = String(normalizedAmount);
    await this.withdrawalSettingRepo.save(settings);

    return {
      minWithdrawalAmountInr: normalizedAmount,
      holdDays: this.getRewardHoldDays(),
    };
  }

  async createWithdrawalRequest(
    userId: number,
    amountInr: number
  ): Promise<UserWithdrawalListItem> {
    const normalizedAmount = this.roundInr(amountInr);
    if (
      !Number.isFinite(normalizedAmount) ||
      normalizedAmount <= 0 ||
      this.toPaise(normalizedAmount) < 100
    ) {
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: "invalid_withdrawal_amount",
      };
    }

    const request = await AppDataSource.transaction(async (manager) => {
      const lockedUser = await manager
        .getRepository(User)
        .createQueryBuilder("user")
        .where("user.id = :userId", { userId })
        .setLock("pessimistic_write")
        .getOne();

      if (!lockedUser || lockedUser.deletedAt) {
        throw {
          statusCode: HttpStatusCode._NOT_FOUND,
          message: "user_not_found",
        };
      }

      const billingDetails = await this.getBillingDetailsForPayout(userId, manager);
      this.assertBillingDetailsReadyForPayout(billingDetails);

      const wallet = await this.getWalletSummary(userId, manager);
      if (normalizedAmount < wallet.minWithdrawalAmount) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "withdrawal_amount_below_minimum",
        };
      }

      if (normalizedAmount > wallet.withdrawableAmount) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "withdrawal_amount_exceeds_withdrawable_balance",
        };
      }

      const created = manager.getRepository(WithdrawalRequest).create({
        userId: String(userId),
        amountInr: String(normalizedAmount),
        status: "requested",
      });

      return manager.getRepository(WithdrawalRequest).save(created);
    });

    return this.mapWithdrawalRequest(request);
  }

  async approveWithdrawalRequest(
    withdrawalId: number,
    adminUserId: number,
    notes?: string | null
  ): Promise<AdminWithdrawalListItem> {
    const request = await AppDataSource.transaction(async (manager) => {
      const withdrawalRepo = manager.getRepository(WithdrawalRequest);
      const lockedRequest = await withdrawalRepo
        .createQueryBuilder("withdrawal")
        .leftJoinAndSelect("withdrawal.user", "user")
        .where("withdrawal.id = :withdrawalId", { withdrawalId })
        .setLock("pessimistic_write")
        .getOne();

      if (!lockedRequest) {
        throw {
          statusCode: HttpStatusCode._NOT_FOUND,
          message: "withdrawal_not_found",
        };
      }

      if (
        lockedRequest.status !== "requested" &&
        !(lockedRequest.status === "approved" && !lockedRequest.razorpayPayoutId)
      ) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "withdrawal_not_approvable",
        };
      }

      const billingDetails = await this.getBillingDetailsForPayout(
        Number(lockedRequest.userId),
        manager
      );
      this.assertBillingDetailsReadyForPayout(billingDetails);

      const contactId =
        billingDetails.razorpayContactId ||
        (
          await this.razorpayX.createContact({
            name: String(billingDetails.accountHolderName).trim(),
            email: lockedRequest.user?.email ?? null,
            type: "customer",
            referenceId: `user_${lockedRequest.userId}`,
            notes: {
              userId: String(lockedRequest.userId),
              withdrawalId: String(lockedRequest.id),
            },
          })
        ).id;

      const fundAccountId =
        billingDetails.razorpayFundAccountId ||
        (
          await this.razorpayX.createFundAccount({
            contactId,
            accountHolderName: String(billingDetails.accountHolderName).trim(),
            ifscCode: String(billingDetails.ifscCode).trim().toUpperCase(),
            accountNumber: String(billingDetails.accountNumber).trim(),
          })
        ).id;

      if (
        billingDetails.razorpayContactId !== contactId ||
        billingDetails.razorpayFundAccountId !== fundAccountId
      ) {
        billingDetails.razorpayContactId = contactId;
        billingDetails.razorpayFundAccountId = fundAccountId;
        await manager.getRepository(UserBillingDetails).save(billingDetails);
      }

      const timestamp = new Date();
      const payoutIdempotencyKey =
        lockedRequest.payoutIdempotencyKey || `wd_${lockedRequest.id}`;
      const payout = await this.razorpayX.createPayout({
        sourceAccountNumber: this.requireSourceAccountNumber(),
        fundAccountId,
        amountPaise: this.toPaise(this.parseAmount(lockedRequest.amountInr)),
        referenceId: `withdrawal_${lockedRequest.id}`,
        narration: `TBR WD ${lockedRequest.id}`.slice(0, 30),
        notes: {
          withdrawalId: String(lockedRequest.id),
          userId: String(lockedRequest.userId),
        },
        idempotencyKey: payoutIdempotencyKey,
      });

      lockedRequest.adminReviewedByUserId = String(adminUserId);
      lockedRequest.adminReviewedAt = timestamp;
      lockedRequest.adminReviewNotes = notes ?? lockedRequest.adminReviewNotes ?? null;
      lockedRequest.payoutIdempotencyKey = payoutIdempotencyKey;
      lockedRequest.razorpayContactId = contactId;
      lockedRequest.razorpayFundAccountId = fundAccountId;
      lockedRequest.razorpayPayoutId = payout.id;
      lockedRequest.razorpayPayoutStatus = payout.status;
      lockedRequest.statusDetails = payout as any;
      lockedRequest.failureCode = null;
      lockedRequest.failureDescription = null;

      this.applyWithdrawalStatus(lockedRequest, "approved", timestamp);
      this.applyWithdrawalStatus(
        lockedRequest,
        this.mapWithdrawalStatus(payout.status),
        timestamp
      );

      return withdrawalRepo.save(lockedRequest);
    });

    return this.mapAdminWithdrawalRequest(request);
  }

  async rejectWithdrawalRequest(
    withdrawalId: number,
    adminUserId: number,
    notes?: string | null
  ): Promise<AdminWithdrawalListItem> {
    const request = await AppDataSource.transaction(async (manager) => {
      const withdrawalRepo = manager.getRepository(WithdrawalRequest);
      const lockedRequest = await withdrawalRepo
        .createQueryBuilder("withdrawal")
        .leftJoinAndSelect("withdrawal.user", "user")
        .where("withdrawal.id = :withdrawalId", { withdrawalId })
        .setLock("pessimistic_write")
        .getOne();

      if (!lockedRequest) {
        throw {
          statusCode: HttpStatusCode._NOT_FOUND,
          message: "withdrawal_not_found",
        };
      }

      if (
        lockedRequest.status !== "requested" &&
        !(lockedRequest.status === "approved" && !lockedRequest.razorpayPayoutId)
      ) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "withdrawal_not_rejectable",
        };
      }

      const timestamp = new Date();
      lockedRequest.adminReviewedByUserId = String(adminUserId);
      lockedRequest.adminReviewedAt = timestamp;
      lockedRequest.adminReviewNotes = notes ?? lockedRequest.adminReviewNotes ?? null;
      this.applyWithdrawalStatus(lockedRequest, "rejected", timestamp);

      return withdrawalRepo.save(lockedRequest);
    });

    return this.mapAdminWithdrawalRequest(request);
  }

  async handleRazorpayXPayoutWebhook(event: any): Promise<void> {
    const payout = event?.payload?.payout?.entity;
    if (!payout?.id) {
      return;
    }

    const nextStatus = this.mapWithdrawalStatus(String(payout.status || event?.event || ""));
    const request = await this.withdrawalRepo.findOne({
      where: { razorpayPayoutId: String(payout.id) } as any,
    });

    if (!request) {
      return;
    }

    const timestamp = new Date();
    request.razorpayPayoutStatus = String(payout.status || request.razorpayPayoutStatus || "");
    request.statusDetails = event;
    request.failureCode = String(
      payout.failure_code || payout.status_details?.reason || ""
    ) || null;
    request.failureDescription = String(
      payout.failure_reason || payout.status_details?.description || ""
    ) || null;

    this.applyWithdrawalStatus(request, nextStatus, timestamp);

    await this.withdrawalRepo.save(request);
  }

  private async upsertSubscriptionFromInvoice(
    trx: EntityManager,
    invoice: SubscriptionInvoice
  ) {
    const userSubRepo = trx.getRepository(UserSubscription);

    const userId = Number(invoice.userId);
    const planId = Number(invoice.planId);

    const existing = await userSubRepo.findOne({
      where: {
        userId,
        planId,
        statusV2: "active",
      } as any,
    });
    if (!existing) {
      await this.assertPlanStrategyAvailableForNewSubscription(trx, planId);
    }

    const startDate = new Date(invoice.billingPeriodStart);
    const endDate = new Date(invoice.billingPeriodEnd);

    if (existing) {
      const currentEnd = (existing as any).endDate
        ? new Date((existing as any).endDate)
        : null;
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

      const savedExisting = await userSubRepo.save(existing);
      const subscription = await this.userSubscriptionDb.ensureWebhookToken(
        savedExisting,
        trx
      );
      await this.userSubscriptionDb.upsertStrategyInstanceForSubscription(
        subscription,
        trx
      );
      return {
        subscription,
        subscriptionEventType: "subscription.renewed" as const,
      };
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
    } as any) as unknown as UserSubscription;

    const savedCreated = await userSubRepo.save(created);
    const subscription = await this.userSubscriptionDb.ensureWebhookToken(
      savedCreated,
      trx
    );
    await this.userSubscriptionDb.upsertStrategyInstanceForSubscription(
      subscription,
      trx
    );
    return {
      subscription,
      subscriptionEventType: "subscription.activated" as const,
    };
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

  async listInvoicesForUser(userId: number, page: number, limit: number) {
    const repo = AppDataSource.getRepository(SubscriptionInvoice);
    const [items, total] = await repo.findAndCount({
      where: { userId } as any,
      order: { createdAt: "DESC" } as any,
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total };
  }
}
