"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
// src/app/user/services/user.service.ts
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const user_db_1 = require("./user.db");
const auth_1 = require("../../../middleware/auth");
const email_verification_util_1 = require("../utils/email-verification.util");
const email_verification_service_1 = require("./email-verification.service");
const subscriberPlan_enum_1 = require("../../subscriptionPlan/enums/subscriberPlan.enum");
const constants_1 = require("../../../types/constants");
const userSubscription_db_1 = require("../../userSubscription/services/userSubscription.db");
const billing_db_1 = require("../../billing/services/billing.db");
const adminStrategyTradeSchedule_util_1 = require("../utils/adminStrategyTradeSchedule.util");
const SALT_ROUNDS = 12;
const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 15; // 15 days
class UserService {
    constructor() {
        this.db = new user_db_1.UserDBService();
        this.userSubscriptionDb = new userSubscription_db_1.UserSubscriptionDBService();
        this.billingDb = new billing_db_1.BillingDBService();
    }
    async ensureSchema() {
        await this.db.ensureSchema();
    }
    singleAdminConflict() {
        return {
            statusCode: constants_1.HttpStatusCode._CONFLICT,
            message: "single_admin_only",
        };
    }
    async ensureAdminCreationAllowed(excludeUserId) {
        const existingAdminCount = await this.db.countAdmins(excludeUserId);
        if (existingAdminCount > 0) {
            throw this.singleAdminConflict();
        }
    }
    resolveRoles(user) {
        return user.isAdmin ? [auth_1.Roles.ADMIN, auth_1.Roles.USER] : [auth_1.Roles.USER];
    }
    normalizeReferralCode(referralCode) {
        const normalized = String(referralCode ?? "")
            .trim()
            .toUpperCase();
        return normalized || null;
    }
    generateReferralCode() {
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        const bytes = crypto_1.default.randomBytes(8);
        return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
    }
    isReferralCodeUniqueViolation(error) {
        return (error?.code === "23505" &&
            String(error?.constraint || "") === "uq_users_referral_code_nonnull");
    }
    async resolveReferrerUserId(referralCode) {
        const normalizedReferralCode = this.normalizeReferralCode(referralCode);
        if (!normalizedReferralCode) {
            return null;
        }
        const referrer = await this.db.findByReferralCode(normalizedReferralCode);
        if (!referrer) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "invalid_referral_code",
            };
        }
        return Number(referrer.id);
    }
    async createUserWithReferralCode(params) {
        for (let attempt = 0; attempt < 5; attempt += 1) {
            try {
                return await this.db.createUser({
                    ...params,
                    referralCode: this.generateReferralCode(),
                });
            }
            catch (error) {
                if (attempt < 4 && this.isReferralCodeUniqueViolation(error)) {
                    continue;
                }
                throw error;
            }
        }
        throw {
            statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
            message: "referral_code_generation_failed",
        };
    }
    maskEmail(email) {
        const [localPart = "", domainPart = ""] = String(email || "").split("@");
        const prefixLength = localPart.length <= 2 ? 1 : 2;
        const safePrefix = localPart.slice(0, prefixLength) || "*";
        return domainPart ? `${safePrefix}***@${domainPart}` : `${safePrefix}***`;
    }
    mapReferralNode(user, includeFullEmails) {
        return includeFullEmails
            ? {
                id: Number(user.id),
                name: user.name ?? null,
                email: user.email,
                createdAt: user.createdAt,
            }
            : {
                id: Number(user.id),
                name: user.name ?? null,
                maskedEmail: this.maskEmail(user.email),
                createdAt: user.createdAt,
            };
    }
    emptyTradeCounts() {
        return {
            active: 0,
            closed: 0,
            failed: 0,
            total: 0,
        };
    }
    sortActivePlans(left, right) {
        return right.createdAt.getTime() - left.createdAt.getTime();
    }
    sortPastPlans(left, right) {
        const leftEnd = left.endDate?.getTime() ?? null;
        const rightEnd = right.endDate?.getTime() ?? null;
        if (leftEnd === null && rightEnd !== null)
            return 1;
        if (leftEnd !== null && rightEnd === null)
            return -1;
        if (leftEnd !== null && rightEnd !== null && leftEnd !== rightEnd) {
            return rightEnd - leftEnd;
        }
        return right.createdAt.getTime() - left.createdAt.getTime();
    }
    mapSubscription(subscription, strategyMap) {
        const firstPlanStrategy = subscription.plan.planStrategies?.[0];
        return {
            id: Number(subscription.id),
            userId: Number(subscription.userId),
            planId: Number(subscription.planId),
            status: subscription.statusV2 ?? null,
            autoRenew: subscription.autoRenew,
            executionEnabled: subscription.executionEnabled,
            isWebhookEnabled: subscription.isWebhookEnabled,
            startDate: subscription.startDate,
            endDate: subscription.endDate ?? null,
            cancelAt: subscription.cancelAt ?? null,
            createdAt: subscription.createdAt,
            updatedAt: subscription.updatedAt,
            strategy: firstPlanStrategy
                ? strategyMap.get(Number(subscription.id)) ?? null
                : null,
            plan: {
                id: Number(subscription.plan.id),
                name: subscription.plan.name,
                description: subscription.plan.description ?? null,
                isActive: subscription.plan.isActive,
                market: subscription.plan.market
                    ? {
                        id: Number(subscription.plan.market.id),
                        code: subscription.plan.market.code,
                        name: subscription.plan.market.name,
                    }
                    : null,
                planType: {
                    id: String(subscription.plan.planType.id),
                    code: subscription.plan.planType.code,
                    name: subscription.plan.planType.name,
                },
                pricing: subscription.plan.pricing
                    ? {
                        priceInr: subscription.plan.pricing.priceInr,
                        currency: subscription.plan.pricing.currency,
                        interval: subscription.plan.pricing.interval,
                        isFree: subscription.plan.pricing.isFree,
                    }
                    : null,
            },
        };
    }
    buildTradeCountMap(rows) {
        return new Map(rows.map((row) => [
            row.tradingAccountId,
            {
                active: row.active,
                closed: row.closed,
                failed: row.failed,
                total: row.total,
            },
        ]));
    }
    sumTradeCounts(rows) {
        return rows.reduce((acc, row) => ({
            active: acc.active + row.active,
            closed: acc.closed + row.closed,
            failed: acc.failed + row.failed,
            total: acc.total + row.total,
        }), this.emptyTradeCounts());
    }
    mapAccount(account, tradeCounts) {
        const subscription = account.subscription;
        const market = subscription?.plan?.market ?? null;
        return {
            id: Number(account.id),
            subscriptionId: account.subscriptionId !== null ? Number(account.subscriptionId) : null,
            accountId: account.accountId,
            accountLabel: account.accountLabel ?? null,
            isMaster: account.isMaster,
            isEnabled: account.isEnabled,
            status: account.status,
            lastVerifiedAt: account.lastVerifiedAt ?? null,
            createdAt: account.createdAt,
            updatedAt: account.updatedAt,
            broker: {
                id: Number(account.broker.id),
                code: account.broker.code,
                name: account.broker.name,
                marketCategory: account.broker.marketCategory,
                isActive: account.broker.isActive,
            },
            market: {
                code: market?.code ?? null,
                name: market?.name ?? null,
                brokerCategory: account.broker.marketCategory ?? null,
            },
            subscription: {
                id: subscription ? Number(subscription.id) : null,
                status: subscription?.statusV2 ?? null,
                planId: subscription?.planId !== undefined && subscription?.planId !== null
                    ? Number(subscription.planId)
                    : null,
                planName: subscription?.plan?.name ?? null,
            },
            tradeCounts,
        };
    }
    mapSettingsAccount(account) {
        const subscription = account.subscription;
        return {
            id: Number(account.id),
            accountId: account.accountId,
            accountLabel: account.accountLabel ?? null,
            isEnabled: account.isEnabled,
            isMaster: account.isMaster,
            status: account.status,
            lastVerifiedAt: account.lastVerifiedAt ?? null,
            broker: {
                id: Number(account.broker.id),
                code: account.broker.code,
                name: account.broker.name,
                marketCategory: account.broker.marketCategory,
            },
            subscription: subscription
                ? {
                    id: Number(subscription.id),
                    planId: subscription.planId !== undefined && subscription.planId !== null
                        ? Number(subscription.planId)
                        : null,
                    planName: subscription.plan?.name ?? null,
                    status: subscription.statusV2 ?? null,
                }
                : null,
        };
    }
    mapRiskLimits(riskLimits) {
        return {
            isEnabled: riskLimits.isEnabled,
            dailyLossLimit: riskLimits.dailyLossLimit !== null
                ? Number(riskLimits.dailyLossLimit)
                : null,
            dailyProfitTarget: riskLimits.dailyProfitTarget !== null
                ? Number(riskLimits.dailyProfitTarget)
                : null,
            maxTradesPerDay: riskLimits.maxTradesPerDay !== null
                ? Number(riskLimits.maxTradesPerDay)
                : null,
            cooldownAfterLossMins: riskLimits.cooldownAfterLossMins !== null
                ? Number(riskLimits.cooldownAfterLossMins)
                : null,
            updatedAt: riskLimits.updatedAt,
        };
    }
    mapAdminStrategyTradeSchedule(schedule) {
        return {
            isEnabled: schedule.isEnabled,
            timezone: schedule.timezone,
            windows: Array.isArray(schedule.windows)
                ? schedule.windows
                : [],
            updatedAt: schedule.updatedAt,
        };
    }
    // ========== LOGIN WITH EMAIL/PASSWORD ==========
    async loginWithEmail(email, password) {
        if (!email || !password) {
            throw new Error("Email and password are required");
        }
        const user = await this.db.findByEmail(email);
        if (!user)
            throw new Error("Invalid credentials");
        const ok = await bcryptjs_1.default.compare(password, user.passwordHash || "");
        if (!ok)
            throw new Error("Invalid credentials");
        const access = (0, auth_1.signAccessToken)({
            userId: user.id,
            roles: this.resolveRoles(user),
        });
        const { refreshJwt } = await this.issueRefreshToken(user);
        return { user, accessToken: access, refreshToken: refreshJwt };
    }
    // ========== REGISTER WITH EMAIL/PASSWORD ==========
    async registerWithEmail(email, password, name, isAdmin = false, referralCode) {
        if (!email || !password) {
            throw new Error("Email and password are required");
        }
        const exists = await this.db.findByEmail(email);
        if (exists)
            throw new Error("Email already registered");
        if (isAdmin) {
            await this.ensureAdminCreationAllowed();
        }
        const hash = await bcryptjs_1.default.hash(password, SALT_ROUNDS);
        const referredByUserId = await this.resolveReferrerUserId(referralCode);
        const user = await this.createUserWithReferralCode({
            email,
            name: name ?? null,
            passwordHash: hash,
            isEmailVerified: false,
            isAdmin,
            referredByUserId,
        });
        const { raw, hash: tokenHash } = (0, email_verification_util_1.generateEmailVerificationToken)();
        await this.db.setEmailVerificationToken(user.id, tokenHash);
        await (0, email_verification_service_1.sendUserVerificationEmail)(user.email, raw);
        const access = (0, auth_1.signAccessToken)({
            userId: user.id,
            roles: this.resolveRoles(user),
        });
        const { refreshJwt } = await this.issueRefreshToken(user);
        return {
            user,
            accessToken: access,
            refreshToken: refreshJwt,
            emailVerificationRequired: true,
            isNewUser: true,
        };
    }
    // ========== REGISTER/LOGIN WITH PROVIDER (GOOGLE, ETC) ==========
    async registerWithProvider(provider, providerUserId, email, name, isAdmin = false, referralCode) {
        if (!provider || !providerUserId) {
            throw new Error("provider and providerUserId are required");
        }
        if (!email) {
            throw new Error("Email is required for provider signup");
        }
        let user = await this.db.findByEmail(email);
        let isNewUser = false;
        // 1. If no user, create one with dummy password so DB NOT NULL is respected
        if (!user) {
            if (isAdmin) {
                await this.ensureAdminCreationAllowed();
            }
            const dummyPassword = crypto_1.default.randomBytes(32).toString("hex");
            const dummyHash = await bcryptjs_1.default.hash(dummyPassword, SALT_ROUNDS);
            const referredByUserId = await this.resolveReferrerUserId(referralCode);
            user = await this.createUserWithReferralCode({
                email,
                name: name ?? null,
                passwordHash: dummyHash,
                isEmailVerified: true,
                isAdmin,
                referredByUserId,
            });
            isNewUser = true;
        }
        // 2. Ensure provider record exists for this user
        let providerDetails = await this.db.getProvider(user.id);
        if (!providerDetails) {
            await this.db.createAuthProvider(user, provider, providerUserId, {
                createdAt: new Date(),
            });
        }
        // 3. Issue tokens
        const access = (0, auth_1.signAccessToken)({
            userId: user.id,
            roles: this.resolveRoles(user),
        });
        const { refreshJwt } = await this.issueRefreshToken(user);
        return { user, accessToken: access, refreshToken: refreshJwt, isNewUser };
    }
    // ========== INTERNAL: ISSUE REFRESH TOKEN ==========
    async issueRefreshToken(user) {
        const refreshPlain = crypto_1.default.randomBytes(48).toString("hex");
        const refreshHash = crypto_1.default
            .createHash("sha256")
            .update(refreshPlain)
            .digest("hex");
        const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
        await this.db.saveRefreshToken(user, refreshHash, expiresAt);
        const refreshJwt = (0, auth_1.signRefreshToken)({
            userId: user.id,
            tokenHash: refreshHash,
        });
        return { refreshJwt };
    }
    async verifyEmail(token) {
        if (!token) {
            throw new Error("Invalid token");
        }
        const tokenHash = crypto_1.default.createHash("sha256").update(token).digest("hex");
        const user = await this.db.findByVerificationToken(tokenHash);
        if (!user) {
            throw new Error("Invalid or expired verification token");
        }
        await this.db.markEmailVerified(user.id);
    }
    async getUserDetails(userId) {
        try {
            return this.db.getUserDetails(userId);
        }
        catch (error) {
            throw error;
        }
    }
    buildSubscriptionStrategyMap(instances) {
        return new Map(instances.map((instance) => [
            Number(instance.subscriptionId),
            {
                instanceId: Number(instance.id),
                status: instance.status,
                volume: Number(instance.volume),
                definition: {
                    id: Number(instance.strategy.id),
                    strategyCode: instance.strategy.strategyCode,
                    name: instance.strategy.name,
                    isActive: Boolean(instance.strategy.isActive),
                },
                managedByAdminWebhook: true,
            },
        ]));
    }
    async getDashboardData(userId) {
        try {
            const [user, subscriptions, accounts, tradeCountRows] = await Promise.all([
                this.db.getDashboardUserProfile(userId),
                this.db.getDashboardSubscriptions(userId),
                this.db.getDashboardAccounts(userId),
                this.db.getDashboardTradeCountsByAccount(userId),
            ]);
            if (!user) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "user_not_found",
                };
            }
            const strategyInstances = await this.userSubscriptionDb.getStrategyInstancesForSubscriptions(userId, subscriptions.map((subscription) => Number(subscription.id)));
            const strategyMap = this.buildSubscriptionStrategyMap(strategyInstances);
            const mappedSubscriptions = subscriptions.map((subscription) => this.mapSubscription(subscription, strategyMap));
            const activePlans = mappedSubscriptions
                .filter((subscription) => subscription.status === subscriberPlan_enum_1.SubscriptionStatus.ACTIVE)
                .sort((left, right) => this.sortActivePlans(left, right));
            const pastPlans = mappedSubscriptions
                .filter((subscription) => subscription.status !== subscriberPlan_enum_1.SubscriptionStatus.ACTIVE)
                .sort((left, right) => this.sortPastPlans(left, right));
            const tradeCountMap = this.buildTradeCountMap(tradeCountRows);
            const accountsWithTradeCounts = accounts.map((account) => this.mapAccount(account, tradeCountMap.get(account.id) ?? this.emptyTradeCounts()));
            return {
                user: user,
                stats: {
                    trades: this.sumTradeCounts(tradeCountRows),
                },
                plans: {
                    active: activePlans,
                    past: pastPlans,
                },
                accounts: accountsWithTradeCounts,
            };
        }
        catch (error) {
            throw error;
        }
    }
    async getSettingsData(userId) {
        try {
            const [{ user, edging, riskLimits, accounts }, wallet] = await Promise.all([
                this.db.getUserSettingsData(userId),
                this.billingDb.getWalletSummary(userId),
            ]);
            if (!user) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "user_not_found",
                };
            }
            return {
                trade: {
                    allowTrade: user.allowTrade,
                },
                copyTrade: {
                    allowCopyTrade: user.allowCopyTrade,
                },
                edging: {
                    isEnabled: edging.isEnabled,
                    notes: edging.notes ?? null,
                    updatedAt: edging.updatedAt,
                },
                riskLimits: this.mapRiskLimits(riskLimits),
                wallet,
                accounts: accounts.map((account) => this.mapSettingsAccount(account)),
            };
        }
        catch (error) {
            throw error;
        }
    }
    async getAdminStrategyTradeSchedule() {
        try {
            const schedule = await this.db.getAdminStrategyTradeSchedule();
            return this.mapAdminStrategyTradeSchedule(schedule);
        }
        catch (error) {
            throw error;
        }
    }
    async upsertAdminStrategyTradeSchedule(payload) {
        try {
            const normalizedPayload = (0, adminStrategyTradeSchedule_util_1.normalizeAdminStrategyTradeScheduleInput)(payload);
            const schedule = await this.db.upsertAdminStrategyTradeSchedule(normalizedPayload);
            return this.mapAdminStrategyTradeSchedule(schedule);
        }
        catch (error) {
            throw error;
        }
    }
    async upsertRiskLimits(userId, payload) {
        try {
            const riskLimits = await this.db.upsertRiskLimits(userId, payload);
            return this.mapRiskLimits(riskLimits);
        }
        catch (error) {
            throw error;
        }
    }
    async getBillingDetails(userId) {
        try {
            return this.db.getBillingDetails(userId);
        }
        catch (error) {
            throw error;
        }
    }
    async upsertBillingDetails(userId, payload) {
        try {
            return this.db.upsertBillingDetails(userId, payload);
        }
        catch (error) {
            throw error;
        }
    }
    async updateTradeStatus(userId, allowTrade) {
        try {
            return this.db.updateTradeStatus(userId, allowTrade);
        }
        catch (error) {
            throw error;
        }
    }
    async updateCopyTradeStatus(userId, allowCopyTrade) {
        try {
            return this.db.updateCopyTradeStatus(userId, allowCopyTrade);
        }
        catch (error) {
            throw error;
        }
    }
    async getEdgingStatus(userId) {
        try {
            return this.db.getEdgingStatus(userId);
        }
        catch (error) {
            throw error;
        }
    }
    async upsertEdgingStatus(userId, isEnabled, notes) {
        try {
            return this.db.upsertEdgingStatus(userId, isEnabled, notes);
        }
        catch (error) {
            throw error;
        }
    }
    async listUsers(params) {
        try {
            return this.db.listUsers(params);
        }
        catch (error) {
            throw error;
        }
    }
    async getReferralSummary(userId, includeFullEmails = false) {
        if (!Number.isFinite(userId) || userId <= 0) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "invalid_user_id",
            };
        }
        const data = await this.db.getReferralSummaryData(userId);
        if (!data) {
            throw {
                statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                message: "user_not_found",
            };
        }
        const level1 = data.level1Downline.map((item) => this.mapReferralNode(item, includeFullEmails));
        const level2 = data.level2Downline.map((item) => this.mapReferralNode(item, includeFullEmails));
        return {
            user: {
                id: Number(data.user.id),
                referralCode: data.user.referralCode ?? null,
            },
            upline: {
                level1: data.level1Upline
                    ? this.mapReferralNode(data.level1Upline, includeFullEmails)
                    : null,
                level2: data.level2Upline
                    ? this.mapReferralNode(data.level2Upline, includeFullEmails)
                    : null,
            },
            counts: {
                level1: level1.length,
                level2: level2.length,
                total: level1.length + level2.length,
            },
            downline: {
                level1,
                level2,
            },
        };
    }
    async updateAdminStatus(userId, isAdmin) {
        if (!Number.isFinite(userId) || userId <= 0) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "invalid_user_id",
            };
        }
        try {
            const existingUser = await this.db.findById(userId);
            if (!existingUser) {
                throw {
                    statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "user_not_found",
                };
            }
            if (isAdmin && !existingUser.isAdmin) {
                await this.ensureAdminCreationAllowed(userId);
            }
            const user = await this.db.updateAdminStatus(userId, isAdmin);
            if (!user) {
                throw {
                    statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "user_not_found",
                };
            }
            return user;
        }
        catch (error) {
            throw error;
        }
    }
}
exports.UserService = UserService;
