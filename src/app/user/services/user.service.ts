// src/app/user/services/user.service.ts
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { UserDBService } from "./user.db";
import {
  signAccessToken,
  signRefreshToken,
  Roles,
} from "../../../middleware/auth";
import { User } from "../../../entity/User";
import { AuthProvider } from "../../../entity/AuthProvider";
import { generateEmailVerificationToken } from "../utils/email-verification.util";
import { sendUserVerificationEmail } from "./email-verification.service";
import { UserBillingDetails } from "../../../entity/UserBillingDetails";
import { UserEdgingStatus } from "../../../entity/UserEdgingStatus";
import { UserRiskLimits } from "../../../entity/UserRiskLimits";
import {
  AdminUserListItem,
  AdminStrategyTradeScheduleSettings,
  DashboardAccount,
  DashboardResponse,
  DashboardSubscription,
  DashboardTradeCountRow,
  DashboardTradeCounts,
  DashboardUserProfile,
  ReferralSummary,
  ReferralTreeNode,
  TradingSettingsAccount,
  UserSettingsResponse,
  UserSettingsRiskLimits,
} from "../interfaces";
import { UserSubscription } from "../../../entity/UserSubscription";
import { SubscriptionStatus } from "../../subscriptionPlan/enums/subscriberPlan.enum";
import { UserTradingAccount } from "../../../entity/UserTradingAccount";
import { HttpStatusCode } from "../../../types/constants";
import { UserSubscriptionDBService } from "../../userSubscription/services/userSubscription.db";
import { BillingDBService } from "../../billing/services/billing.db";
import { normalizeAdminStrategyTradeScheduleInput } from "../utils/adminStrategyTradeSchedule.util";

const SALT_ROUNDS = 12;
const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 15; // 15 days

export class UserService {
  private db = new UserDBService();
  private userSubscriptionDb = new UserSubscriptionDBService();
  private billingDb = new BillingDBService();

  async ensureSchema() {
    await this.db.ensureSchema();
  }

  private singleAdminConflict() {
    return {
      statusCode: HttpStatusCode._CONFLICT,
      message: "single_admin_only",
    };
  }

  private async ensureAdminCreationAllowed(excludeUserId?: number) {
    const existingAdminCount = await this.db.countAdmins(excludeUserId);
    if (existingAdminCount > 0) {
      throw this.singleAdminConflict();
    }
  }

  private resolveRoles(user: User): Roles[] {
    return user.isAdmin ? [Roles.ADMIN, Roles.USER] : [Roles.USER];
  }

  private normalizeReferralCode(referralCode?: string | null): string | null {
    const normalized = String(referralCode ?? "")
      .trim()
      .toUpperCase();

    return normalized || null;
  }

  private generateReferralCode(): string {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const bytes = crypto.randomBytes(8);

    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  }

  private isReferralCodeUniqueViolation(error: any): boolean {
    return (
      error?.code === "23505" &&
      String(error?.constraint || "") === "uq_users_referral_code_nonnull"
    );
  }

  private async resolveReferrerUserId(
    referralCode?: string | null
  ): Promise<number | null> {
    const normalizedReferralCode = this.normalizeReferralCode(referralCode);
    if (!normalizedReferralCode) {
      return null;
    }

    const referrer = await this.db.findByReferralCode(normalizedReferralCode);
    if (!referrer) {
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: "invalid_referral_code",
      };
    }

    return Number(referrer.id);
  }

  private async createUserWithReferralCode(params: {
    email: string;
    name?: string | null;
    passwordHash: string;
    isEmailVerified?: boolean;
    isAdmin?: boolean;
    referredByUserId?: number | null;
  }): Promise<User> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.db.createUser({
          ...params,
          referralCode: this.generateReferralCode(),
        });
      } catch (error: any) {
        if (attempt < 4 && this.isReferralCodeUniqueViolation(error)) {
          continue;
        }
        throw error;
      }
    }

    throw {
      statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
      message: "referral_code_generation_failed",
    };
  }

  private maskEmail(email: string): string {
    const [localPart = "", domainPart = ""] = String(email || "").split("@");
    const prefixLength = localPart.length <= 2 ? 1 : 2;
    const safePrefix = localPart.slice(0, prefixLength) || "*";

    return domainPart ? `${safePrefix}***@${domainPart}` : `${safePrefix}***`;
  }

  private mapReferralNode(
    user: Pick<User, "id" | "name" | "email" | "createdAt">,
    includeFullEmails: boolean
  ): ReferralTreeNode {
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

  private emptyTradeCounts(): DashboardTradeCounts {
    return {
      active: 0,
      closed: 0,
      failed: 0,
      total: 0,
    };
  }

  private sortActivePlans(
    left: DashboardSubscription,
    right: DashboardSubscription
  ): number {
    return right.createdAt.getTime() - left.createdAt.getTime();
  }

  private sortPastPlans(
    left: DashboardSubscription,
    right: DashboardSubscription
  ): number {
    const leftEnd = left.endDate?.getTime() ?? null;
    const rightEnd = right.endDate?.getTime() ?? null;

    if (leftEnd === null && rightEnd !== null) return 1;
    if (leftEnd !== null && rightEnd === null) return -1;
    if (leftEnd !== null && rightEnd !== null && leftEnd !== rightEnd) {
      return rightEnd - leftEnd;
    }

    return right.createdAt.getTime() - left.createdAt.getTime();
  }

  private mapSubscription(
    subscription: UserSubscription,
    strategyMap: Map<number, DashboardSubscription["strategy"]>
  ): DashboardSubscription {
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

  private buildTradeCountMap(
    rows: DashboardTradeCountRow[]
  ): Map<number, DashboardTradeCounts> {
    return new Map(
      rows.map((row) => [
        row.tradingAccountId,
        {
          active: row.active,
          closed: row.closed,
          failed: row.failed,
          total: row.total,
        },
      ])
    );
  }

  private sumTradeCounts(rows: DashboardTradeCountRow[]): DashboardTradeCounts {
    return rows.reduce<DashboardTradeCounts>(
      (acc, row) => ({
        active: acc.active + row.active,
        closed: acc.closed + row.closed,
        failed: acc.failed + row.failed,
        total: acc.total + row.total,
      }),
      this.emptyTradeCounts()
    );
  }

  private mapAccount(
    account: UserTradingAccount,
    tradeCounts: DashboardTradeCounts
  ): DashboardAccount {
    const subscription = account.subscription;
    const market = subscription?.plan?.market ?? null;

    return {
      id: Number(account.id),
      subscriptionId:
        account.subscriptionId !== null ? Number(account.subscriptionId) : null,
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
        planId:
          subscription?.planId !== undefined && subscription?.planId !== null
            ? Number(subscription.planId)
            : null,
        planName: subscription?.plan?.name ?? null,
      },
      tradeCounts,
    };
  }

  private mapSettingsAccount(account: UserTradingAccount): TradingSettingsAccount {
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
            planId:
              subscription.planId !== undefined && subscription.planId !== null
                ? Number(subscription.planId)
                : null,
            planName: subscription.plan?.name ?? null,
            status: subscription.statusV2 ?? null,
          }
        : null,
    };
  }

  private mapRiskLimits(riskLimits: UserRiskLimits): UserSettingsRiskLimits {
    return {
      isEnabled: riskLimits.isEnabled,
      ...(riskLimits.configuration !== undefined ? { configuration: riskLimits.configuration } : {}),
      dailyLossLimit:
        riskLimits.dailyLossLimit !== null
          ? Number(riskLimits.dailyLossLimit)
          : null,
      dailyProfitTarget:
        riskLimits.dailyProfitTarget !== null
          ? Number(riskLimits.dailyProfitTarget)
          : null,
      maxTradesPerDay:
        riskLimits.maxTradesPerDay !== null
          ? Number(riskLimits.maxTradesPerDay)
          : null,
      cooldownAfterLossMins:
        riskLimits.cooldownAfterLossMins !== null
          ? Number(riskLimits.cooldownAfterLossMins)
          : null,
      updatedAt: riskLimits.updatedAt,
    };
  }

  private mapAdminStrategyTradeSchedule(
    schedule: {
      isEnabled: boolean;
      timezone: string;
      windows: unknown;
      updatedAt: Date;
    }
  ): AdminStrategyTradeScheduleSettings {
    return {
      isEnabled: schedule.isEnabled,
      timezone: schedule.timezone,
      windows: Array.isArray(schedule.windows)
        ? (schedule.windows as AdminStrategyTradeScheduleSettings["windows"])
        : [],
      updatedAt: schedule.updatedAt,
    };
  }

  // ========== LOGIN WITH EMAIL/PASSWORD ==========
  async loginWithEmail(email: string, password: string) {
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const user = await this.db.findByEmail(email);
    if (!user) throw new Error("Invalid credentials");

    const ok = await bcrypt.compare(password, user.passwordHash || "");
    if (!ok) throw new Error("Invalid credentials");

    const access = signAccessToken({
      userId: user.id,
      roles: this.resolveRoles(user),
    });
    const { refreshJwt } = await this.issueRefreshToken(user);

    return { user, accessToken: access, refreshToken: refreshJwt };
  }

  // ========== REGISTER WITH EMAIL/PASSWORD ==========
  async registerWithEmail(
    email: string,
    password: string,
    name?: string,
    isAdmin = false,
    referralCode?: string | null
  ) {
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const exists = await this.db.findByEmail(email);
    if (exists) throw new Error("Email already registered");

    if (isAdmin) {
      await this.ensureAdminCreationAllowed();
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const referredByUserId = await this.resolveReferrerUserId(referralCode);

    const user = await this.createUserWithReferralCode({
      email,
      name: name ?? null,
      passwordHash: hash,
      isEmailVerified: false,
      isAdmin,
      referredByUserId,
    });

    const { raw, hash: tokenHash } = generateEmailVerificationToken();
    await this.db.setEmailVerificationToken(user.id, tokenHash);

    await sendUserVerificationEmail(user.email, raw);

    const access = signAccessToken({
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
  async registerWithProvider(
    provider: string,
    providerUserId: string,
    email: string,
    name?: string,
    isAdmin = false,
    referralCode?: string | null
  ) {
    if (!provider || !providerUserId) {
      throw new Error("provider and providerUserId are required");
    }
    if (!email) {
      throw new Error("Email is required for provider signup");
    }

    let user: User | null = await this.db.findByEmail(email);
    let isNewUser = false;

    // 1. If no user, create one with dummy password so DB NOT NULL is respected
    if (!user) {
      if (isAdmin) {
        await this.ensureAdminCreationAllowed();
      }

      const dummyPassword = crypto.randomBytes(32).toString("hex");
      const dummyHash = await bcrypt.hash(dummyPassword, SALT_ROUNDS);
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
    let providerDetails: AuthProvider | null = await this.db.getProvider(
      user.id
    );

    if (!providerDetails) {
      await this.db.createAuthProvider(user, provider, providerUserId, {
        createdAt: new Date(),
      });
    }

    // 3. Issue tokens
    const access = signAccessToken({
      userId: user.id,
      roles: this.resolveRoles(user),
    });
    const { refreshJwt } = await this.issueRefreshToken(user);

    return { user, accessToken: access, refreshToken: refreshJwt, isNewUser };
  }

  // ========== INTERNAL: ISSUE REFRESH TOKEN ==========
  private async issueRefreshToken(user: User): Promise<{ refreshJwt: string }> {
    const refreshPlain = crypto.randomBytes(48).toString("hex");
    const refreshHash = crypto
      .createHash("sha256")
      .update(refreshPlain)
      .digest("hex");
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

    await this.db.saveRefreshToken(user, refreshHash, expiresAt);

    const refreshJwt = signRefreshToken({
      userId: user.id,
      tokenHash: refreshHash,
    });

    return { refreshJwt };
  }

  async verifyEmail(token: string): Promise<void> {
    if (!token) {
      throw new Error("Invalid token");
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await this.db.findByVerificationToken(tokenHash);

    if (!user) {
      throw new Error("Invalid or expired verification token");
    }

    await this.db.markEmailVerified(user.id);
  }
  async getUserDetails(userId: number): Promise<User> {
    try {
      return this.db.getUserDetails(userId);
    } catch (error) {
      throw error;
    }
  }

  private buildSubscriptionStrategyMap(
    instances: Awaited<
      ReturnType<UserSubscriptionDBService["getStrategyInstancesForSubscriptions"]>
    >
  ): Map<number, DashboardSubscription["strategy"]> {
    return new Map(
      instances.map((instance) => [
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
          managedByAdminWebhook: true as const,
        },
      ])
    );
  }

  async getDashboardData(
    userId: number
  ): Promise<DashboardResponse["data"]> {
    try {
      const [user, subscriptions, accounts, tradeCountRows] = await Promise.all([
        this.db.getDashboardUserProfile(userId),
        this.db.getDashboardSubscriptions(userId),
        this.db.getDashboardAccounts(userId),
        this.db.getDashboardTradeCountsByAccount(userId),
      ]);

      if (!user) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "user_not_found",
        };
      }

      const strategyInstances =
        await this.userSubscriptionDb.getStrategyInstancesForSubscriptions(
          userId,
          subscriptions.map((subscription) => Number(subscription.id))
        );
      const strategyMap = this.buildSubscriptionStrategyMap(strategyInstances);

      const mappedSubscriptions = subscriptions.map((subscription) =>
        this.mapSubscription(subscription, strategyMap)
      );

      const activePlans = mappedSubscriptions
        .filter((subscription) => subscription.status === SubscriptionStatus.ACTIVE)
        .sort((left, right) => this.sortActivePlans(left, right));

      const pastPlans = mappedSubscriptions
        .filter((subscription) => subscription.status !== SubscriptionStatus.ACTIVE)
        .sort((left, right) => this.sortPastPlans(left, right));

      const tradeCountMap = this.buildTradeCountMap(tradeCountRows);
      const accountsWithTradeCounts = accounts.map((account) =>
        this.mapAccount(
          account,
          tradeCountMap.get(account.id) ?? this.emptyTradeCounts()
        )
      );

      return {
        user: user as DashboardUserProfile,
        stats: {
          trades: this.sumTradeCounts(tradeCountRows),
        },
        plans: {
          active: activePlans,
          past: pastPlans,
        },
        accounts: accountsWithTradeCounts,
      };
    } catch (error) {
      throw error;
    }
  }

  async getSettingsData(userId: number): Promise<UserSettingsResponse> {
    try {
      const [{ user, edging, riskLimits, accounts }, wallet] = await Promise.all([
        this.db.getUserSettingsData(userId),
        this.billingDb.getWalletSummary(userId),
      ]);

      if (!user) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
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
    } catch (error) {
      throw error;
    }
  }

  async getAdminStrategyTradeSchedule(): Promise<AdminStrategyTradeScheduleSettings> {
    try {
      const schedule = await this.db.getAdminStrategyTradeSchedule();
      return this.mapAdminStrategyTradeSchedule(schedule);
    } catch (error) {
      throw error;
    }
  }

  async upsertAdminStrategyTradeSchedule(payload: {
    isEnabled?: unknown;
    timezone?: unknown;
    windows?: unknown;
  }): Promise<AdminStrategyTradeScheduleSettings> {
    try {
      const normalizedPayload =
        normalizeAdminStrategyTradeScheduleInput(payload);
      const schedule = await this.db.upsertAdminStrategyTradeSchedule(
        normalizedPayload
      );
      return this.mapAdminStrategyTradeSchedule(schedule);
    } catch (error) {
      throw error;
    }
  }

  async upsertRiskLimits(
    userId: number,
    payload: {
      isEnabled: boolean;
      dailyLossLimit?: number | null;
      dailyProfitTarget?: number | null;
      maxTradesPerDay?: number | null;
      cooldownAfterLossMins?: number | null;
      configuration?: Record<string, any>;
    }
  ): Promise<UserSettingsRiskLimits> {
    try {
      const riskLimits = await this.db.upsertRiskLimits(userId, payload);
      return this.mapRiskLimits(riskLimits);
    } catch (error) {
      throw error;
    }
  }

  async getBillingDetails(userId: number): Promise<UserBillingDetails | null> {
    try {
      return this.db.getBillingDetails(userId);
    } catch (error) {
      throw error;
    }
  }

  async upsertBillingDetails(
    userId: number,
    payload: Partial<UserBillingDetails>
  ): Promise<UserBillingDetails> {
    try {
      return this.db.upsertBillingDetails(userId, payload);
    } catch (error) {
      throw error;
    }
  }

  async updateTradeStatus(userId: number, allowTrade: boolean): Promise<User> {
    try {
      return this.db.updateTradeStatus(userId, allowTrade);
    } catch (error) {
      throw error;
    }
  }

  async updateCopyTradeStatus(
    userId: number,
    allowCopyTrade: boolean
  ): Promise<User> {
    try {
      return this.db.updateCopyTradeStatus(userId, allowCopyTrade);
    } catch (error) {
      throw error;
    }
  }

  async getEdgingStatus(userId: number): Promise<UserEdgingStatus> {
    try {
      return this.db.getEdgingStatus(userId);
    } catch (error) {
      throw error;
    }
  }

  async upsertEdgingStatus(
    userId: number,
    isEnabled: boolean,
    notes?: string | null
  ): Promise<UserEdgingStatus> {
    try {
      return this.db.upsertEdgingStatus(userId, isEnabled, notes);
    } catch (error) {
      throw error;
    }
  }

  async listUsers(params: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<{
    items: AdminUserListItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      return this.db.listUsers(params);
    } catch (error) {
      throw error;
    }
  }

  async getReferralSummary(
    userId: number,
    includeFullEmails = false
  ): Promise<ReferralSummary> {
    if (!Number.isFinite(userId) || userId <= 0) {
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: "invalid_user_id",
      };
    }

    const data = await this.db.getReferralSummaryData(userId);
    if (!data) {
      throw {
        statusCode: HttpStatusCode._NOT_FOUND,
        message: "user_not_found",
      };
    }

    const level1 = data.level1Downline.map((item) =>
      this.mapReferralNode(item, includeFullEmails)
    );
    const level2 = data.level2Downline.map((item) =>
      this.mapReferralNode(item, includeFullEmails)
    );

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

  async updateAdminStatus(userId: number, isAdmin: boolean): Promise<User> {
    if (!Number.isFinite(userId) || userId <= 0) {
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: "invalid_user_id",
      };
    }

    try {
      const existingUser = await this.db.findById(userId);
      if (!existingUser) {
        throw {
          statusCode: HttpStatusCode._NOT_FOUND,
          message: "user_not_found",
        };
      }

      if (isAdmin && !existingUser.isAdmin) {
        await this.ensureAdminCreationAllowed(userId);
      }

      const user = await this.db.updateAdminStatus(userId, isAdmin);
      if (!user) {
        throw {
          statusCode: HttpStatusCode._NOT_FOUND,
          message: "user_not_found",
        };
      }

      return user;
    } catch (error) {
      throw error;
    }
  }
}
