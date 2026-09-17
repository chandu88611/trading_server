// src/app/user/services/user.db.ts
import { EntityManager } from "typeorm";
import AppDataSource from "../../../db/data-source";
import { User } from "../../../entity/User";
import { AuthProvider } from "../../../entity/AuthProvider";
import { RefreshToken } from "../../../entity/RefreshToken";
import { HttpStatusCode } from "../../../types/constants";
import { UserBillingDetails } from "../../../entity/UserBillingDetails";
import { UserEdgingStatus } from "../../../entity/UserEdgingStatus";
import { UserRiskLimits } from "../../../entity/UserRiskLimits";
import { UserSubscription } from "../../../entity/UserSubscription";
import { UserTradingAccount } from "../../../entity/UserTradingAccount";
import { TradeSignal } from "../../../entity/TradeSignals";
import { AdminStrategyTradeScheduleSetting } from "../../../entity/AdminStrategyTradeScheduleSetting";
import {
  AdminUserListItem,
  AdminStrategyTradeScheduleSettings,
  DashboardTradeCountRow,
  DashboardUserProfile,
} from "../interfaces";
import { DEFAULT_ADMIN_STRATEGY_TRADE_SCHEDULE_TIMEZONE } from "../utils/adminStrategyTradeSchedule.util";

type ReferralUserRecord = Pick<
  User,
  "id" | "name" | "email" | "createdAt" | "referralCode" | "referredByUserId"
>;

type ReferralSummaryData = {
  user: ReferralUserRecord;
  level1Upline: ReferralUserRecord | null;
  level2Upline: ReferralUserRecord | null;
  level1Downline: ReferralUserRecord[];
  level2Downline: ReferralUserRecord[];
};

type AdminUserListRawRow = {
  id: string | number;
  email: string;
  name: string | null;
  isEmailVerified: boolean | string;
  isActive: boolean | string;
  isAdmin: boolean | string;
  allowTrade: boolean | string;
  allowCopyTrade: boolean | string;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastLoginAt: Date | string | null;
  referralCode: string | null;
  referredByUserId: string | number | null;
  level1ReferralCount: string | number;
  level2ReferralCount: string | number;
};

type UserSettingsData = {
  user: DashboardUserProfile | null;
  edging: UserEdgingStatus;
  riskLimits: UserRiskLimits;
  accounts: UserTradingAccount[];
};

export class UserDBService {
  private userRepo = AppDataSource.getRepository(User);
  private authRepo = AppDataSource.getRepository(AuthProvider);
  private tokenRepo = AppDataSource.getRepository(RefreshToken);
  private billingRepo = AppDataSource.getRepository(UserBillingDetails);
  private edgingRepo = AppDataSource.getRepository(UserEdgingStatus);
  private riskLimitsRepo = AppDataSource.getRepository(UserRiskLimits);
  private adminStrategyTradeScheduleRepo = AppDataSource.getRepository(
    AdminStrategyTradeScheduleSetting
  );
  private subscriptionRepo = AppDataSource.getRepository(UserSubscription);
  private tradingAccountRepo = AppDataSource.getRepository(UserTradingAccount);
  private tradeSignalRepo = AppDataSource.getRepository(TradeSignal);

  private getManager(manager?: EntityManager) {
    return manager ?? this.userRepo.manager;
  }

  private parseBoolean(value: unknown): boolean {
    return value === true || value === "true";
  }

  private mapAdminUserListRow(row: AdminUserListRawRow): AdminUserListItem {
    return {
      id: Number(row.id),
      email: row.email,
      name: row.name ?? null,
      isEmailVerified: this.parseBoolean(row.isEmailVerified),
      isActive: this.parseBoolean(row.isActive),
      isAdmin: this.parseBoolean(row.isAdmin),
      allowTrade: this.parseBoolean(row.allowTrade),
      allowCopyTrade: this.parseBoolean(row.allowCopyTrade),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      lastLoginAt: row.lastLoginAt ? new Date(row.lastLoginAt) : null,
      referralCode: row.referralCode ?? null,
      referredByUserId:
        row.referredByUserId === null || row.referredByUserId === undefined
          ? null
          : Number(row.referredByUserId),
      level1ReferralCount: Number(row.level1ReferralCount ?? 0),
      level2ReferralCount: Number(row.level2ReferralCount ?? 0),
    };
  }

  private async getReferralUserById(
    userId: number
  ): Promise<ReferralUserRecord | null> {
    return this.userRepo
      .createQueryBuilder("user")
      .select([
        "user.id",
        "user.name",
        "user.email",
        "user.createdAt",
        "user.referralCode",
        "user.referredByUserId",
      ])
      .where("user.id = :userId", { userId })
      .andWhere("user.deleted_at IS NULL")
      .getOne();
  }

  private async getReferralUsersByParentIds(
    parentUserIds: number[]
  ): Promise<ReferralUserRecord[]> {
    if (!parentUserIds.length) {
      return [];
    }

    return this.userRepo
      .createQueryBuilder("user")
      .select([
        "user.id",
        "user.name",
        "user.email",
        "user.createdAt",
        "user.referralCode",
        "user.referredByUserId",
      ])
      .where("user.referred_by_user_id IN (:...parentUserIds)", {
        parentUserIds,
      })
      .andWhere("user.deleted_at IS NULL")
      .orderBy("user.created_at", "DESC")
      .getMany();
  }

  async ensureSchema(): Promise<void> {
    const rows = await AppDataSource.query(`
      SELECT COUNT(*)::int AS admin_count
      FROM users
      WHERE is_admin = true
        AND deleted_at IS NULL;
    `);

    const adminCount = Number(rows?.[0]?.admin_count ?? 0);
    if (adminCount > 1) {
      throw new Error(
        `Single admin migration blocked: found ${adminCount} admin users. Demote extras before rollout.`
      );
    }

    await AppDataSource.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS referral_code TEXT;
    `);

    await AppDataSource.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS referred_by_user_id INT;
    `);

    await AppDataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_users_referral_code_nonnull
      ON users (referral_code)
      WHERE referral_code IS NOT NULL;
    `);

    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_users_referred_by_user_id
      ON users (referred_by_user_id);
    `);

    await AppDataSource.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'fk_users_referred_by_user_id'
        ) THEN
          ALTER TABLE users
          ADD CONSTRAINT fk_users_referred_by_user_id
          FOREIGN KEY (referred_by_user_id)
          REFERENCES users(id)
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await AppDataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_users_single_active_admin
      ON users ((1))
      WHERE is_admin = true
        AND deleted_at IS NULL;
    `);

    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS user_risk_limits (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        daily_loss_limit NUMERIC(15, 2),
        daily_profit_target NUMERIC(15, 2),
        max_trades_per_day INT,
        cooldown_after_loss_mins INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await AppDataSource.query(`ALTER TABLE user_risk_limits ADD COLUMN IF NOT EXISTS configuration JSONB NOT NULL DEFAULT '{}'::jsonb`);

    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS admin_strategy_trade_schedule_settings (
        id INT PRIMARY KEY,
        is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        timezone TEXT NOT NULL DEFAULT '${DEFAULT_ADMIN_STRATEGY_TRADE_SCHEDULE_TIMEZONE}',
        windows JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await AppDataSource.query(`
      INSERT INTO admin_strategy_trade_schedule_settings (id, is_enabled, timezone, windows)
      VALUES (1, FALSE, '${DEFAULT_ADMIN_STRATEGY_TRADE_SCHEDULE_TIMEZONE}', '[]'::jsonb)
      ON CONFLICT (id) DO NOTHING;
    `);
  }

  async countAdmins(excludeUserId?: number): Promise<number> {
    const qb = this.userRepo
      .createQueryBuilder("user")
      .where("user.is_admin = true")
      .andWhere("user.deleted_at IS NULL");

    if (Number.isFinite(excludeUserId) && Number(excludeUserId) > 0) {
      qb.andWhere("user.id != :excludeUserId", {
        excludeUserId: Number(excludeUserId),
      });
    }

    return qb.getCount();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findById(id: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async findByReferralCode(code: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder("user")
      .where("user.referral_code = :code", { code })
      .andWhere("user.deleted_at IS NULL")
      .getOne();
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
    const page = Math.max(1, params.page);
    const limit = Math.min(100, Math.max(1, params.limit));
    const search = String(params.search || "").trim();

    const qb = this.userRepo.createQueryBuilder("u").where("u.deleted_at IS NULL");

    if (search) {
      qb.andWhere("(u.email ILIKE :search OR u.name ILIKE :search)", {
        search: `%${search}%`,
      });
    }

    const total = await qb.getCount();

    const items = await qb
      .clone()
      .select("u.id", "id")
      .addSelect("u.email", "email")
      .addSelect("u.name", "name")
      .addSelect("u.isEmailVerified", "isEmailVerified")
      .addSelect("u.isActive", "isActive")
      .addSelect("u.isAdmin", "isAdmin")
      .addSelect("u.allowTrade", "allowTrade")
      .addSelect("u.allowCopyTrade", "allowCopyTrade")
      .addSelect("u.createdAt", "createdAt")
      .addSelect("u.updatedAt", "updatedAt")
      .addSelect("u.lastLoginAt", "lastLoginAt")
      .addSelect("u.referralCode", "referralCode")
      .addSelect("u.referredByUserId", "referredByUserId")
      .addSelect(
        `
        (
          SELECT COUNT(*)::int
          FROM users level1
          WHERE level1.referred_by_user_id = u.id
            AND level1.deleted_at IS NULL
        )
        `,
        "level1ReferralCount"
      )
      .addSelect(
        `
        (
          SELECT COUNT(*)::int
          FROM users level2
          WHERE level2.deleted_at IS NULL
            AND level2.referred_by_user_id IN (
              SELECT level1.id
              FROM users level1
              WHERE level1.referred_by_user_id = u.id
                AND level1.deleted_at IS NULL
            )
        )
        `,
        "level2ReferralCount"
      )
      .orderBy("u.created_at", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getRawMany<AdminUserListRawRow>();

    return {
      items: items.map((item) => this.mapAdminUserListRow(item)),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getProvider(userId: number): Promise<AuthProvider | null> {
    return this.authRepo.findOne({ where: { userId } });
  }

  async createUser(params: {
    email: string;
    name?: string | null;
    passwordHash: string;
    isEmailVerified?: boolean;
    isAdmin?: boolean;
    referralCode?: string | null;
    referredByUserId?: number | null;
  }): Promise<User> {
    const u = this.userRepo.create({
      email: params.email,
      name: params.name ?? null,
      referralCode: params.referralCode ?? null,
      referredByUserId: params.referredByUserId ?? null,
      passwordHash: params.passwordHash,
      isEmailVerified: params.isEmailVerified ?? false,
      isActive: true,
      isAdmin: params.isAdmin ?? false,
    });
    return this.userRepo.save(u);
  }

  async updateAdminStatus(userId: number, isAdmin: boolean): Promise<User | null> {
    const user = await this.findById(userId);
    if (!user) return null;

    user.isAdmin = isAdmin;
    return this.userRepo.save(user);
  }

  async createAuthProvider(
    user: User,
    provider: string,
    providerUserId: string,
    meta?: Record<string, any>
  ): Promise<AuthProvider> {
    const ap = this.authRepo.create({
      user,
      userId: user.id,
      provider,
      providerUserId: `${providerUserId}`,
      providerMeta: meta,
    });
    return this.authRepo.save(ap);
  }

  // ========= REFRESH TOKENS ==========

  async saveRefreshToken(
    user: User,
    tokenHash: string,
    expiresAt?: Date
  ): Promise<RefreshToken> {
    const rt = this.tokenRepo.create({
      user,
      userId: user.id,
      tokenHash,
      expiresAt: expiresAt ?? null,
      revoked: false,
    });
    return this.tokenRepo.save(rt);
  }

  async findRefreshTokenByHash(
    tokenHash: string
  ): Promise<RefreshToken | null> {
    return this.tokenRepo.findOne({
      where: { tokenHash },
      relations: ["user"],
    });
  }

  async findRefreshTokenForUser(
    userId: number,
    tokenHash: string
  ): Promise<RefreshToken | null> {
    return this.tokenRepo.findOne({
      where: { tokenHash, userId },
      relations: ["user"],
    });
  }

  async revokeRefreshTokenByHash(tokenHash: string): Promise<void> {
    await this.tokenRepo.update({ tokenHash }, { revoked: true });
  }

  async revokeAllRefreshTokensForUser(userId: number): Promise<void> {
    await this.tokenRepo.update({ userId }, { revoked: true });
  }
  async setEmailVerificationToken(
    userId: number,
    tokenHash: string
  ): Promise<void> {
    await this.userRepo.update(
      { id: userId },
      { verificationToken: tokenHash }
    );
  }

  async findByVerificationToken(tokenHash: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: {
        verificationToken: tokenHash,
        isEmailVerified: false,
      },
    });
  }

  async markEmailVerified(userId: number): Promise<void> {
    await this.userRepo.update(
      { id: userId },
      {
        isEmailVerified: true,
        verificationToken: null,
      }
    );
  }

  async getReferralSummaryData(
    userId: number
  ): Promise<ReferralSummaryData | null> {
    const user = await this.getReferralUserById(userId);
    if (!user) {
      return null;
    }

    let level1Upline: ReferralUserRecord | null = null;
    let level2Upline: ReferralUserRecord | null = null;

    if (user.referredByUserId) {
      level1Upline = await this.getReferralUserById(Number(user.referredByUserId));
      if (level1Upline?.referredByUserId) {
        level2Upline = await this.getReferralUserById(
          Number(level1Upline.referredByUserId)
        );
      }
    }

    const level1Downline = await this.getReferralUsersByParentIds([
      Number(user.id),
    ]);
    const level2ParentIds = level1Downline.map((item) => Number(item.id));
    const level2Downline = await this.getReferralUsersByParentIds(level2ParentIds);

    return {
      user,
      level1Upline,
      level2Upline,
      level1Downline,
      level2Downline,
    };
  }

  async getUserDetails(userId: number): Promise<User> {
    try {
      let userData: User | null = await this.userRepo.findOne({
        where: { id: userId },
        select: [
          "id",
          "email",
          "name",
          "isEmailVerified",
          "isActive",
          "isAdmin",
          "allowTrade",
          "createdAt",
          "updatedAt",
        ],
      });
      if (!userData) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "user_not_found",
        };
      } else {
        return userData;
      }
    } catch (error) {
      throw error;
    }
  }

  async getDashboardUserProfile(
    userId: number
  ): Promise<DashboardUserProfile | null> {
    return this.userRepo.findOne({
      where: { id: userId },
      select: [
        "id",
        "email",
        "name",
        "isEmailVerified",
        "isActive",
        "isAdmin",
        "allowTrade",
        "allowCopyTrade",
        "createdAt",
        "updatedAt",
        "lastLoginAt",
      ],
    });
  }

  async getDashboardSubscriptions(userId: number): Promise<UserSubscription[]> {
    return this.subscriptionRepo.find({
      where: { userId },
      relations: {
        plan: {
          market: true,
          planType: true,
          pricing: true,
          planStrategies: {
            strategy: true,
          },
        },
      },
    });
  }

  async getDashboardAccounts(userId: number): Promise<UserTradingAccount[]> {
    return this.tradingAccountRepo.find({
      where: { userId },
      relations: {
        broker: true,
        subscription: {
          plan: {
            market: true,
          },
        },
      },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async getUserSettingsData(userId: number): Promise<UserSettingsData> {
    const [user, edging, riskLimits, accounts] = await Promise.all([
      this.getDashboardUserProfile(userId),
      this.getEdgingStatus(userId),
      this.getRiskLimits(userId),
      this.getDashboardAccounts(userId),
    ]);

    return {
      user,
      edging,
      riskLimits,
      accounts,
    };
  }

  async getAdminStrategyTradeSchedule(): Promise<AdminStrategyTradeScheduleSetting> {
    let schedule = await this.adminStrategyTradeScheduleRepo.findOne({
      where: { id: 1 },
    });

    if (!schedule) {
      schedule = this.adminStrategyTradeScheduleRepo.create({
        id: 1,
        isEnabled: false,
        timezone: DEFAULT_ADMIN_STRATEGY_TRADE_SCHEDULE_TIMEZONE,
        windows: [],
      });
      schedule = await this.adminStrategyTradeScheduleRepo.save(schedule);
    }

    return schedule;
  }

  async upsertAdminStrategyTradeSchedule(
    payload: Omit<AdminStrategyTradeScheduleSettings, "updatedAt">
  ): Promise<AdminStrategyTradeScheduleSetting> {
    const schedule = await this.getAdminStrategyTradeSchedule();
    schedule.isEnabled = payload.isEnabled;
    schedule.timezone = payload.timezone;
    schedule.windows = payload.windows as Array<Record<string, unknown>>;
    return this.adminStrategyTradeScheduleRepo.save(schedule);
  }

  async getDashboardTradeCountsByAccount(
    userId: number
  ): Promise<DashboardTradeCountRow[]> {
    const rawRows = await this.tradeSignalRepo
      .createQueryBuilder("ts")
      .innerJoin("ts.tradingAccount", "ta")
      .leftJoin("ts.status", "tss")
      .select("ts.tradingAccountId", "tradingAccountId")
      .addSelect(
        "COALESCE(SUM(CASE WHEN tss.status IN ('pending', 'in_progress', 'completed') THEN 1 ELSE 0 END), 0)",
        "active"
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN tss.status IN ('closed', 'pending_close') THEN 1 ELSE 0 END), 0)",
        "closed"
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN tss.status = 'failed' THEN 1 ELSE 0 END), 0)",
        "failed"
      )
      .where("ta.userId = :userId", { userId })
      .groupBy("ts.tradingAccountId")
      .getRawMany<{
        tradingAccountId: string;
        active: string;
        closed: string;
        failed: string;
      }>();

    return rawRows.map((row) => {
      const active = Number(row.active ?? 0);
      const closed = Number(row.closed ?? 0);
      const failed = Number(row.failed ?? 0);

      return {
        tradingAccountId: Number(row.tradingAccountId),
        active,
        closed,
        failed,
        total: active + closed + failed,
      };
    });
  }

  async getBillingDetails(userId: number): Promise<UserBillingDetails | null> {
    try {
      return this.billingRepo.findOne({
        where: { userId: String(userId) },
      });
    } catch (error) {
      throw error;
    }
  }

  async upsertBillingDetails(
    userId: number,
    payload: Partial<UserBillingDetails>
  ): Promise<UserBillingDetails> {
    try {
      const existing = await this.billingRepo.findOne({
        where: { userId: String(userId) },
      });

      if (existing) {
        // update only provided fields (don’t wipe with undefined)
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== undefined) (existing as any)[k] = v;
        });

        // never allow changing userId
        (existing as any).userId = String(userId);

        return this.billingRepo.save(existing);
      }

      const created = this.billingRepo.create({
        userId: String(userId),
        panNumber: payload.panNumber ?? null,
        accountHolderName: payload.accountHolderName ?? null,
        accountNumber: payload.accountNumber ?? null,
        ifscCode: payload.ifscCode ?? null,
        bankName: payload.bankName ?? null,
        branch: payload.branch ?? null,
        addressLine1: payload.addressLine1 ?? null,
        addressLine2: payload.addressLine2 ?? null,
        city: payload.city ?? null,
        state: payload.state ?? null,
        pincode: payload.pincode ?? null,
      });

      return this.billingRepo.save(created);
    } catch (error) {
      throw error;
    }
  }

  async updateAllTradingAccountsEnabledForUser(
    userId: number,
    isEnabled: boolean,
    manager?: EntityManager
  ): Promise<void> {
    await this.getManager(manager)
      .getRepository(UserTradingAccount)
      .createQueryBuilder()
      .update(UserTradingAccount)
      .set({ isEnabled })
      .where("user_id = :userId", { userId })
      .execute();
  }

  async updateTradeStatus(userId: number, allowTrade: boolean): Promise<User> {
    try {
      return AppDataSource.transaction(async (manager) => {
        const userRepo = manager.getRepository(User);
        const user = await userRepo.findOne({ where: { id: userId } });

        if (!user) {
          throw {
            statusCode: HttpStatusCode._BAD_REQUEST,
            message: "user_not_found",
          };
        }

        user.allowTrade = allowTrade;
        const updatedUser = await userRepo.save(user);

        await this.updateAllTradingAccountsEnabledForUser(
          userId,
          allowTrade,
          manager
        );

        return updatedUser;
      });
    } catch (error) {
      throw error;
    }
  }

  async updateCopyTradeStatus(
    userId: number,
    allowCopyTrade: boolean
  ): Promise<User> {
    try {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "user_not_found",
        };
      }
      user.allowCopyTrade = allowCopyTrade;
      return this.userRepo.save(user);
    } catch (error) {
      throw error;
    }
  }

  async getEdgingStatus(userId: number): Promise<UserEdgingStatus> {
    try {
      let edging = await this.edgingRepo.findOne({
        where: { userId: String(userId) },
      });

      if (!edging) {
        edging = this.edgingRepo.create({
          userId: String(userId),
          isEnabled: false,
          notes: null,
        });
        edging = await this.edgingRepo.save(edging);
      }

      return edging;
    } catch (error) {
      throw error;
    }
  }

  async getRiskLimits(userId: number): Promise<UserRiskLimits> {
    try {
      let riskLimits = await this.riskLimitsRepo.findOne({
        where: { userId: String(userId) },
      });

      if (!riskLimits) {
        riskLimits = this.riskLimitsRepo.create({
          userId: String(userId),
          isEnabled: false,
          dailyLossLimit: null,
          dailyProfitTarget: null,
          maxTradesPerDay: null,
          cooldownAfterLossMins: null,
        });
        riskLimits = await this.riskLimitsRepo.save(riskLimits);
      }

      return riskLimits;
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
  ): Promise<UserRiskLimits> {
    try {
      let riskLimits = await this.riskLimitsRepo.findOne({
        where: { userId: String(userId) },
      });

      if (!riskLimits) {
        riskLimits = this.riskLimitsRepo.create({
          userId: String(userId),
          isEnabled: payload.isEnabled,
          dailyLossLimit: payload.dailyLossLimit ?? null,
          dailyProfitTarget: payload.dailyProfitTarget ?? null,
          maxTradesPerDay: payload.maxTradesPerDay ?? null,
          cooldownAfterLossMins: payload.cooldownAfterLossMins ?? null,
        });
      } else {
        riskLimits.isEnabled = payload.isEnabled;
        if (payload.dailyLossLimit !== undefined) {
          riskLimits.dailyLossLimit = payload.dailyLossLimit;
        }
        if (payload.dailyProfitTarget !== undefined) {
          riskLimits.dailyProfitTarget = payload.dailyProfitTarget;
        }
        if (payload.maxTradesPerDay !== undefined) {
          riskLimits.maxTradesPerDay = payload.maxTradesPerDay;
        }
        if (payload.cooldownAfterLossMins !== undefined) {
          riskLimits.cooldownAfterLossMins = payload.cooldownAfterLossMins;
        }
      }

      if (payload.configuration !== undefined) riskLimits.configuration = payload.configuration;
      return this.riskLimitsRepo.save(riskLimits);
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
      let edging = await this.edgingRepo.findOne({
        where: { userId: String(userId) },
      });

      if (!edging) {
        edging = this.edgingRepo.create({
          userId: String(userId),
          isEnabled,
          notes: notes ?? null,
        });
      } else {
        edging.isEnabled = isEnabled;
        if (notes !== undefined) {
          edging.notes = notes;
        }
      }

      return this.edgingRepo.save(edging);
    } catch (error) {
      throw error;
    }
  }
}
