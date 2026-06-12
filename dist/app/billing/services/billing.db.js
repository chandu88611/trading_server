"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingDBService = void 0;
const data_source_1 = __importDefault(require("../../../db/data-source"));
const entity_1 = require("../../../entity");
const RazorpayOrder_1 = require("../../../entity/RazorpayOrder");
const constants_1 = require("../../../types/constants");
const crmLifecycleSync_service_1 = require("../../integrations/crm/services/crmLifecycleSync.service");
const userSubscription_db_1 = require("../../userSubscription/services/userSubscription.db");
const subscriberPlan_enum_1 = require("../../subscriptionPlan/enums/subscriberPlan.enum");
const planStrategy_1 = require("../../subscriptionPlan/utils/planStrategy");
const razorpay_service_1 = require("./razorpay.service");
const razorpayx_service_1 = require("./razorpayx.service");
const LOCKED_WITHDRAWAL_STATUSES = [
    "requested",
    "approved",
    "processing",
    "queued",
];
class BillingDBService {
    constructor() {
        this.paymentRepo = data_source_1.default.getRepository(entity_1.SubscriptionPayment);
        this.invoiceRepo = data_source_1.default.getRepository(entity_1.SubscriptionInvoice);
        this.userSubRepo = data_source_1.default.getRepository(entity_1.UserSubscription);
        this.planRepo = data_source_1.default.getRepository(entity_1.SubscriptionPlan);
        this.withdrawalRepo = data_source_1.default.getRepository(entity_1.WithdrawalRequest);
        this.withdrawalSettingRepo = data_source_1.default.getRepository(entity_1.WithdrawalSetting);
        this.razorpay = new razorpay_service_1.RazorpayService();
        this.razorpayX = new razorpayx_service_1.RazorpayXService();
        this.crmSync = new crmLifecycleSync_service_1.CrmLifecycleSyncService();
        this.userSubscriptionDb = new userSubscription_db_1.UserSubscriptionDBService();
    }
    getManager(manager) {
        return manager ?? this.invoiceRepo.manager;
    }
    async assertPlanStrategyAvailableForNewSubscription(manager, planId) {
        const plan = await manager.getRepository(entity_1.SubscriptionPlan).findOne({
            where: { id: planId },
            relations: { planStrategies: { strategy: true } },
        });
        if (!plan) {
            throw {
                statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                message: "Plan not found",
            };
        }
        if ((0, planStrategy_1.selectUnavailablePlanStrategyForNewSubscription)(plan.planStrategies)) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "strategy_unavailable_for_new_subscription",
            };
        }
    }
    parseAmount(value) {
        const parsed = Number(value ?? 0);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    roundInr(amount) {
        return Math.round((amount + Number.EPSILON) * 100) / 100;
    }
    toPaise(amountInr) {
        return Math.round(this.roundInr(amountInr) * 100);
    }
    getEnvNumber(name, fallback) {
        const raw = String(process.env[name] ?? "").trim();
        if (!raw)
            return fallback;
        const parsed = Number(raw);
        if (!Number.isFinite(parsed))
            return fallback;
        return parsed;
    }
    getRewardAmountInr(level) {
        const envName = level === 1 ? "REFERRAL_LEVEL1_REWARD_INR" : "REFERRAL_LEVEL2_REWARD_INR";
        const amount = this.getEnvNumber(envName, 0);
        return amount > 0 ? this.roundInr(amount) : 0;
    }
    getRewardHoldDays() {
        const holdDays = Math.floor(this.getEnvNumber("REFERRAL_REWARD_HOLD_DAYS", 7));
        return holdDays >= 0 ? holdDays : 7;
    }
    getDefaultMinWithdrawalAmountInr() {
        const amount = this.getEnvNumber("DEFAULT_MIN_WITHDRAWAL_INR", 500);
        return amount > 0 ? this.roundInr(amount) : 500;
    }
    addDays(base, days) {
        const next = new Date(base);
        next.setUTCDate(next.getUTCDate() + days);
        return next;
    }
    requireSourceAccountNumber() {
        const accountNumber = String(process.env.RAZORPAYX_SOURCE_ACCOUNT_NUMBER ?? "").trim();
        if (!accountNumber) {
            throw new Error("razorpayx_source_account_number_missing");
        }
        return accountNumber;
    }
    mapWithdrawalStatus(status) {
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
    applyWithdrawalStatus(request, nextStatus, timestamp) {
        request.status = nextStatus;
        if (nextStatus === "approved")
            request.approvedAt = request.approvedAt ?? timestamp;
        if (nextStatus === "queued")
            request.queuedAt = request.queuedAt ?? timestamp;
        if (nextStatus === "processed")
            request.processedAt = request.processedAt ?? timestamp;
        if (nextStatus === "rejected")
            request.rejectedAt = request.rejectedAt ?? timestamp;
        if (nextStatus === "failed")
            request.failedAt = request.failedAt ?? timestamp;
        if (nextStatus === "reversed")
            request.reversedAt = request.reversedAt ?? timestamp;
    }
    mapWithdrawalRequest(request) {
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
    mapAdminWithdrawalRequest(request) {
        return {
            ...this.mapWithdrawalRequest(request),
            user: {
                id: Number(request.user?.id ?? 0),
                email: request.user?.email ?? "",
                name: request.user?.name ?? null,
            },
        };
    }
    async getWithdrawalSettingsRecord(manager) {
        const repo = this.getManager(manager).getRepository(entity_1.WithdrawalSetting);
        let settings = await repo.findOne({ where: { id: 1 } });
        if (!settings) {
            settings = repo.create({
                id: 1,
                minWithdrawalAmountInr: String(this.getDefaultMinWithdrawalAmountInr()),
            });
            settings = await repo.save(settings);
        }
        return settings;
    }
    async getBillingDetailsForPayout(userId, manager) {
        return this.getManager(manager)
            .getRepository(entity_1.UserBillingDetails)
            .findOne({ where: { userId: String(userId) } });
    }
    assertBillingDetailsReadyForPayout(billingDetails) {
        if (!billingDetails) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
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
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "billing_details_incomplete",
            };
        }
        if (String(billingDetails.accountHolderName ?? "").trim().length < 3) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "billing_details_incomplete",
            };
        }
    }
    async updateRazorpayOrderStatus(razorpayOrderId, status, manager) {
        if (!razorpayOrderId)
            return;
        await this.getManager(manager)
            .getRepository(RazorpayOrder_1.RazorpayOrder)
            .createQueryBuilder()
            .update(RazorpayOrder_1.RazorpayOrder)
            .set({ status: status })
            .where("razorpay_order_id = :razorpayOrderId", { razorpayOrderId })
            .execute();
    }
    async findInvoiceForPayment(manager, args) {
        const invoiceRepo = manager.getRepository(entity_1.SubscriptionInvoice);
        if (args.invoiceId) {
            const byId = await invoiceRepo.findOne({ where: { id: args.invoiceId } });
            if (byId)
                return byId;
        }
        if (args.razorpayOrderId) {
            const orderRow = await manager.getRepository(RazorpayOrder_1.RazorpayOrder).findOne({
                where: { razorpayOrderId: args.razorpayOrderId },
            });
            if (orderRow?.invoiceId) {
                const byOrderLink = await invoiceRepo.findOne({
                    where: { id: Number(orderRow.invoiceId) },
                });
                if (byOrderLink)
                    return byOrderLink;
            }
            const byReference = await invoiceRepo.findOne({
                where: { paymentReference: args.razorpayOrderId },
            });
            if (byReference)
                return byReference;
        }
        return null;
    }
    async getSubscriptionForInvoice(manager, invoice) {
        const repo = manager.getRepository(entity_1.UserSubscription);
        if (invoice.subscriptionId) {
            const byId = await repo.findOne({ where: { id: invoice.subscriptionId } });
            if (byId)
                return byId;
        }
        return repo.findOne({
            where: {
                userId: Number(invoice.userId),
                planId: Number(invoice.planId),
                statusV2: subscriberPlan_enum_1.SubscriptionStatus.ACTIVE,
            },
            order: { createdAt: "DESC" },
        });
    }
    async recordSuccessfulPayment(manager, invoice, args) {
        const paymentRepo = manager.getRepository(entity_1.SubscriptionPayment);
        const fallbackUserId = Number(args.fallbackUserId || 0);
        const existing = await paymentRepo.findOne({
            where: { gatewayEventId: args.razorpayPaymentId },
        });
        if (existing) {
            return existing;
        }
        if (!invoice && fallbackUserId <= 0) {
            return null;
        }
        return paymentRepo.save(paymentRepo.create({
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
        }));
    }
    async awardReferralRewardsForFirstPaidInvoice(manager, invoice) {
        const existingPaidInvoiceCount = await manager
            .getRepository(entity_1.SubscriptionInvoice)
            .createQueryBuilder("invoice")
            .where("invoice.user_id = :userId", { userId: Number(invoice.userId) })
            .andWhere("invoice.status = :status", { status: "paid" })
            .andWhere("invoice.id != :invoiceId", { invoiceId: Number(invoice.id) })
            .getCount();
        if (existingPaidInvoiceCount > 0) {
            return;
        }
        const rewardedUser = await manager.getRepository(entity_1.User).findOne({
            where: { id: Number(invoice.userId) },
        });
        if (!rewardedUser || rewardedUser.deletedAt) {
            return;
        }
        const rewardCredits = [];
        const earnedAt = new Date();
        const availableAt = this.addDays(earnedAt, this.getRewardHoldDays());
        let currentReferrerId = rewardedUser.referredByUserId;
        for (const level of [1, 2]) {
            if (!currentReferrerId)
                break;
            const beneficiary = await manager.getRepository(entity_1.User).findOne({
                where: { id: Number(currentReferrerId) },
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
            .getRepository(entity_1.ReferralRewardCredit)
            .createQueryBuilder()
            .insert()
            .values(rewardCredits)
            .orIgnore()
            .execute();
    }
    async finalizeSuccessfulPayment(manager, args) {
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
        if (args.enforceOwnership &&
            args.userId &&
            Number(invoice.userId) !== Number(args.userId)) {
            throw {
                statusCode: constants_1.HttpStatusCode._UNAUTHORISED,
                message: "invoice_not_owned_by_user",
            };
        }
        const invoiceRepo = manager.getRepository(entity_1.SubscriptionInvoice);
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
    async dispatchPaidInvoiceEvents(result) {
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
    async ensureSchema() {
        await data_source_1.default.query(`
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
        await data_source_1.default.query(`
      CREATE INDEX IF NOT EXISTS idx_razorpay_orders_invoice_id
      ON razorpay_orders (invoice_id);
    `);
        await data_source_1.default.query(`
      CREATE INDEX IF NOT EXISTS idx_razorpay_orders_user_id
      ON razorpay_orders (user_id);
    `);
        await data_source_1.default.query(`
      ALTER TABLE subscription_invoices
      ALTER COLUMN subscription_id DROP NOT NULL;
    `);
        await data_source_1.default.query(`
      ALTER TABLE user_billing_details
      ADD COLUMN IF NOT EXISTS razorpay_contact_id TEXT;
    `);
        await data_source_1.default.query(`
      ALTER TABLE user_billing_details
      ADD COLUMN IF NOT EXISTS razorpay_fund_account_id TEXT;
    `);
        await data_source_1.default.query(`
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
        await data_source_1.default.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_reward_credit_source_beneficiary_level
      ON referral_reward_credits (source_invoice_id, beneficiary_user_id, level);
    `);
        await data_source_1.default.query(`
      CREATE INDEX IF NOT EXISTS idx_referral_reward_credits_beneficiary_user_id
      ON referral_reward_credits (beneficiary_user_id);
    `);
        await data_source_1.default.query(`
      CREATE INDEX IF NOT EXISTS idx_referral_reward_credits_rewarded_user_id
      ON referral_reward_credits (rewarded_user_id);
    `);
        await data_source_1.default.query(`
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
        await data_source_1.default.query(`
      CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id
      ON withdrawal_requests (user_id);
    `);
        await data_source_1.default.query(`
      CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status
      ON withdrawal_requests (status);
    `);
        await data_source_1.default.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_withdrawal_requests_razorpay_payout_id_nonnull
      ON withdrawal_requests (razorpay_payout_id)
      WHERE razorpay_payout_id IS NOT NULL;
    `);
        await data_source_1.default.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_withdrawal_requests_payout_idempotency_key_nonnull
      ON withdrawal_requests (payout_idempotency_key)
      WHERE payout_idempotency_key IS NOT NULL;
    `);
        await data_source_1.default.query(`
      CREATE TABLE IF NOT EXISTS withdrawal_settings (
        id INT PRIMARY KEY,
        min_withdrawal_amount_inr NUMERIC(15, 2) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        await data_source_1.default.query(`
        INSERT INTO withdrawal_settings (id, min_withdrawal_amount_inr)
        VALUES (1, $1)
        ON CONFLICT (id) DO NOTHING;
      `, [String(this.getDefaultMinWithdrawalAmountInr())]);
    }
    async getUserSubscriptionEntity(userId) {
        return this.userSubRepo.findOne({
            where: { userId, statusV2: subscriberPlan_enum_1.SubscriptionStatus.ACTIVE },
            order: { createdAt: "DESC" },
        });
    }
    async getCurrentSubscription(userId) {
        const sub = await this.userSubRepo.findOne({
            where: { userId, statusV2: subscriberPlan_enum_1.SubscriptionStatus.ACTIVE },
            order: { createdAt: "DESC" },
        });
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
        const planPricing = plan.pricing ?? null;
        const currency = String(planPricing?.currency || plan.currency || "INR").toUpperCase();
        const legacySubunitAmount = Math.round(Number(plan.priceCents || 0));
        const pricingAmountInr = Number(planPricing?.priceInr ?? NaN);
        const amountPaise = Number.isFinite(pricingAmountInr)
            ? Math.round(pricingAmountInr * 100)
            : legacySubunitAmount;
        const interval = String(planPricing?.interval || plan.interval || "monthly");
        if (!Number.isFinite(amountPaise) || amountPaise < 100) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "invalid_plan_pricing",
            };
        }
        const now = new Date();
        const billingPeriodStart = now;
        const billingPeriodEnd = this.computePeriodEnd(now, interval);
        return data_source_1.default.transaction(async (trx) => {
            const invoiceRepo = trx.getRepository(entity_1.SubscriptionInvoice);
            const orderRepo = trx.getRepository(RazorpayOrder_1.RazorpayOrder);
            const planId = Number(plan.id);
            const existingActiveSubscription = await trx
                .getRepository(entity_1.UserSubscription)
                .findOne({
                where: {
                    userId,
                    planId,
                    statusV2: subscriberPlan_enum_1.SubscriptionStatus.ACTIVE,
                },
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
            await orderRepo.save(orderRepo.create({
                invoiceId: String(savedInvoice.id),
                userId: String(userId),
                razorpayOrderId: order.id,
                receipt: order.receipt || null,
                amountCents: amountPaise,
                currency,
                status: (order.status || "created"),
                notes: order.notes || {},
            }));
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
    async markInvoicePaidFromClientVerification(args) {
        const result = await data_source_1.default.transaction(async (trx) => this.finalizeSuccessfulPayment(trx, {
            userId: args.userId,
            invoiceId: args.invoiceId,
            razorpayOrderId: args.razorpayOrderId,
            razorpayPaymentId: args.razorpayPaymentId,
            gatewayPayload: args.gatewayPayload,
            source: "client_verify",
            enforceOwnership: true,
        }));
        await this.dispatchPaidInvoiceEvents(result);
        return {
            invoice: result.invoice,
            subscription: result.subscription,
        };
    }
    async handleRazorpayPaymentCaptured(event) {
        const payment = event?.payload?.payment?.entity;
        if (!payment)
            return;
        const notes = payment.notes || {};
        const result = await data_source_1.default.transaction(async (trx) => this.finalizeSuccessfulPayment(trx, {
            userId: Number(notes.userId || 0) || null,
            invoiceId: Number(notes.invoiceId || 0) || null,
            razorpayOrderId: String(payment.order_id || ""),
            razorpayPaymentId: String(payment.id || ""),
            gatewayPayload: event,
            source: "webhook_payment_captured",
            amountPaise: Number(payment.amount || 0),
            currency: String(payment.currency || "INR"),
        }));
        await this.dispatchPaidInvoiceEvents(result);
    }
    async handleRazorpayOrderPaid(event) {
        const order = event?.payload?.order?.entity;
        const payment = event?.payload?.payment?.entity;
        const razorpayOrderId = String(payment?.order_id || order?.id || "");
        await this.updateRazorpayOrderStatus(razorpayOrderId, "paid");
        if (!payment?.id) {
            return;
        }
        const notes = payment.notes || order?.notes || {};
        const result = await data_source_1.default.transaction(async (trx) => this.finalizeSuccessfulPayment(trx, {
            userId: Number(notes.userId || 0) || null,
            invoiceId: Number(notes.invoiceId || 0) || null,
            razorpayOrderId,
            razorpayPaymentId: String(payment.id),
            gatewayPayload: event,
            source: "webhook_order_paid",
            amountPaise: Number(payment.amount || 0),
            currency: String(payment.currency || "INR"),
        }));
        await this.dispatchPaidInvoiceEvents(result);
    }
    async handleRazorpayPaymentFailed(event) {
        const payment = event?.payload?.payment?.entity;
        if (!payment)
            return;
        const razorpayPaymentId = String(payment.id || "");
        const existing = await this.paymentRepo.findOne({
            where: { gatewayEventId: razorpayPaymentId },
        });
        if (existing) {
            await this.updateRazorpayOrderStatus(String(payment.order_id || ""), "failed");
            return;
        }
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
            }));
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
    async cancelLocalSubscription(userId, immediate) {
        const sub = await this.userSubRepo.findOne({
            where: { userId, statusV2: subscriberPlan_enum_1.SubscriptionStatus.ACTIVE },
            order: { createdAt: "DESC" },
        });
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
            sub.status = "canceled";
            sub.statusV2 = "canceled";
            sub.executionEnabled = false;
        }
        const saved = await this.userSubRepo.save(sub);
        await this.userSubscriptionDb.stopStrategyInstancesForSubscription(Number(saved.id));
        await this.crmSync.dispatchSubscriptionCanceled({
            userId,
            subscriptionId: Number(saved.id),
        });
        return saved;
    }
    async getWalletSummary(userId, manager) {
        const rewardCredits = await this.getManager(manager)
            .getRepository(entity_1.ReferralRewardCredit)
            .find({
            where: { beneficiaryUserId: String(userId) },
        });
        const withdrawals = await this.getManager(manager)
            .getRepository(entity_1.WithdrawalRequest)
            .find({
            where: { userId: String(userId) },
        });
        const now = new Date();
        const settings = await this.getWithdrawalSettingsRecord(manager);
        const totalEarned = rewardCredits.reduce((sum, credit) => sum + this.parseAmount(credit.amountInr), 0);
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
            withdrawableAmount: Math.max(0, this.roundInr(availableRewards - lockedWithdrawalAmount - totalWithdrawn)),
            lockedWithdrawalAmount: this.roundInr(lockedWithdrawalAmount),
            totalWithdrawn: this.roundInr(totalWithdrawn),
            minWithdrawalAmount: this.roundInr(this.parseAmount(settings.minWithdrawalAmountInr)),
            holdDays: this.getRewardHoldDays(),
        };
    }
    async listWithdrawals(userId) {
        const requests = await this.withdrawalRepo.find({
            where: { userId: String(userId) },
            order: { createdAt: "DESC" },
        });
        return requests.map((request) => this.mapWithdrawalRequest(request));
    }
    async listAdminWithdrawals() {
        const requests = await this.withdrawalRepo.find({
            relations: { user: true },
            order: { createdAt: "DESC" },
        });
        return requests.map((request) => this.mapAdminWithdrawalRequest(request));
    }
    async getWithdrawalSettings() {
        const settings = await this.getWithdrawalSettingsRecord();
        return {
            minWithdrawalAmountInr: this.roundInr(this.parseAmount(settings.minWithdrawalAmountInr)),
            holdDays: this.getRewardHoldDays(),
        };
    }
    async updateWithdrawalSettings(minWithdrawalAmountInr) {
        const normalizedAmount = this.roundInr(minWithdrawalAmountInr);
        if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
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
    async createWithdrawalRequest(userId, amountInr) {
        const normalizedAmount = this.roundInr(amountInr);
        if (!Number.isFinite(normalizedAmount) ||
            normalizedAmount <= 0 ||
            this.toPaise(normalizedAmount) < 100) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "invalid_withdrawal_amount",
            };
        }
        const request = await data_source_1.default.transaction(async (manager) => {
            const lockedUser = await manager
                .getRepository(entity_1.User)
                .createQueryBuilder("user")
                .where("user.id = :userId", { userId })
                .setLock("pessimistic_write")
                .getOne();
            if (!lockedUser || lockedUser.deletedAt) {
                throw {
                    statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "user_not_found",
                };
            }
            const billingDetails = await this.getBillingDetailsForPayout(userId, manager);
            this.assertBillingDetailsReadyForPayout(billingDetails);
            const wallet = await this.getWalletSummary(userId, manager);
            if (normalizedAmount < wallet.minWithdrawalAmount) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "withdrawal_amount_below_minimum",
                };
            }
            if (normalizedAmount > wallet.withdrawableAmount) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "withdrawal_amount_exceeds_withdrawable_balance",
                };
            }
            const created = manager.getRepository(entity_1.WithdrawalRequest).create({
                userId: String(userId),
                amountInr: String(normalizedAmount),
                status: "requested",
            });
            return manager.getRepository(entity_1.WithdrawalRequest).save(created);
        });
        return this.mapWithdrawalRequest(request);
    }
    async approveWithdrawalRequest(withdrawalId, adminUserId, notes) {
        const request = await data_source_1.default.transaction(async (manager) => {
            const withdrawalRepo = manager.getRepository(entity_1.WithdrawalRequest);
            const lockedRequest = await withdrawalRepo
                .createQueryBuilder("withdrawal")
                .leftJoinAndSelect("withdrawal.user", "user")
                .where("withdrawal.id = :withdrawalId", { withdrawalId })
                .setLock("pessimistic_write")
                .getOne();
            if (!lockedRequest) {
                throw {
                    statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "withdrawal_not_found",
                };
            }
            if (lockedRequest.status !== "requested" &&
                !(lockedRequest.status === "approved" && !lockedRequest.razorpayPayoutId)) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "withdrawal_not_approvable",
                };
            }
            const billingDetails = await this.getBillingDetailsForPayout(Number(lockedRequest.userId), manager);
            this.assertBillingDetailsReadyForPayout(billingDetails);
            const contactId = billingDetails.razorpayContactId ||
                (await this.razorpayX.createContact({
                    name: String(billingDetails.accountHolderName).trim(),
                    email: lockedRequest.user?.email ?? null,
                    type: "customer",
                    referenceId: `user_${lockedRequest.userId}`,
                    notes: {
                        userId: String(lockedRequest.userId),
                        withdrawalId: String(lockedRequest.id),
                    },
                })).id;
            const fundAccountId = billingDetails.razorpayFundAccountId ||
                (await this.razorpayX.createFundAccount({
                    contactId,
                    accountHolderName: String(billingDetails.accountHolderName).trim(),
                    ifscCode: String(billingDetails.ifscCode).trim().toUpperCase(),
                    accountNumber: String(billingDetails.accountNumber).trim(),
                })).id;
            if (billingDetails.razorpayContactId !== contactId ||
                billingDetails.razorpayFundAccountId !== fundAccountId) {
                billingDetails.razorpayContactId = contactId;
                billingDetails.razorpayFundAccountId = fundAccountId;
                await manager.getRepository(entity_1.UserBillingDetails).save(billingDetails);
            }
            const timestamp = new Date();
            const payoutIdempotencyKey = lockedRequest.payoutIdempotencyKey || `wd_${lockedRequest.id}`;
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
            lockedRequest.statusDetails = payout;
            lockedRequest.failureCode = null;
            lockedRequest.failureDescription = null;
            this.applyWithdrawalStatus(lockedRequest, "approved", timestamp);
            this.applyWithdrawalStatus(lockedRequest, this.mapWithdrawalStatus(payout.status), timestamp);
            return withdrawalRepo.save(lockedRequest);
        });
        return this.mapAdminWithdrawalRequest(request);
    }
    async rejectWithdrawalRequest(withdrawalId, adminUserId, notes) {
        const request = await data_source_1.default.transaction(async (manager) => {
            const withdrawalRepo = manager.getRepository(entity_1.WithdrawalRequest);
            const lockedRequest = await withdrawalRepo
                .createQueryBuilder("withdrawal")
                .leftJoinAndSelect("withdrawal.user", "user")
                .where("withdrawal.id = :withdrawalId", { withdrawalId })
                .setLock("pessimistic_write")
                .getOne();
            if (!lockedRequest) {
                throw {
                    statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "withdrawal_not_found",
                };
            }
            if (lockedRequest.status !== "requested" &&
                !(lockedRequest.status === "approved" && !lockedRequest.razorpayPayoutId)) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
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
    async handleRazorpayXPayoutWebhook(event) {
        const payout = event?.payload?.payout?.entity;
        if (!payout?.id) {
            return;
        }
        const nextStatus = this.mapWithdrawalStatus(String(payout.status || event?.event || ""));
        const request = await this.withdrawalRepo.findOne({
            where: { razorpayPayoutId: String(payout.id) },
        });
        if (!request) {
            return;
        }
        const timestamp = new Date();
        request.razorpayPayoutStatus = String(payout.status || request.razorpayPayoutStatus || "");
        request.statusDetails = event;
        request.failureCode = String(payout.failure_code || payout.status_details?.reason || "") || null;
        request.failureDescription = String(payout.failure_reason || payout.status_details?.description || "") || null;
        this.applyWithdrawalStatus(request, nextStatus, timestamp);
        await this.withdrawalRepo.save(request);
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
        if (!existing) {
            await this.assertPlanStrategyAvailableForNewSubscription(trx, planId);
        }
        const startDate = new Date(invoice.billingPeriodStart);
        const endDate = new Date(invoice.billingPeriodEnd);
        if (existing) {
            const currentEnd = existing.endDate
                ? new Date(existing.endDate)
                : null;
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
            const savedExisting = await userSubRepo.save(existing);
            const subscription = await this.userSubscriptionDb.ensureWebhookToken(savedExisting, trx);
            await this.userSubscriptionDb.upsertStrategyInstanceForSubscription(subscription, trx);
            return {
                subscription,
                subscriptionEventType: "subscription.renewed",
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
        });
        const savedCreated = await userSubRepo.save(created);
        const subscription = await this.userSubscriptionDb.ensureWebhookToken(savedCreated, trx);
        await this.userSubscriptionDb.upsertStrategyInstanceForSubscription(subscription, trx);
        return {
            subscription,
            subscriptionEventType: "subscription.activated",
        };
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
    async listInvoicesForUser(userId, page, limit) {
        const repo = data_source_1.default.getRepository(entity_1.SubscriptionInvoice);
        const [items, total] = await repo.findAndCount({
            where: { userId },
            order: { createdAt: "DESC" },
            skip: (page - 1) * limit,
            take: limit,
        });
        return { items, total };
    }
}
exports.BillingDBService = BillingDBService;
