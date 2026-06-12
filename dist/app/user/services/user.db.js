"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserDBService = void 0;
const data_source_1 = __importDefault(require("../../../db/data-source"));
const User_1 = require("../../../entity/User");
const AuthProvider_1 = require("../../../entity/AuthProvider");
const RefreshToken_1 = require("../../../entity/RefreshToken");
const constants_1 = require("../../../types/constants");
const UserBillingDetails_1 = require("../../../entity/UserBillingDetails");
const UserEdgingStatus_1 = require("../../../entity/UserEdgingStatus");
const UserRiskLimits_1 = require("../../../entity/UserRiskLimits");
const UserSubscription_1 = require("../../../entity/UserSubscription");
const UserTradingAccount_1 = require("../../../entity/UserTradingAccount");
const TradeSignals_1 = require("../../../entity/TradeSignals");
const AdminStrategyTradeScheduleSetting_1 = require("../../../entity/AdminStrategyTradeScheduleSetting");
const adminStrategyTradeSchedule_util_1 = require("../utils/adminStrategyTradeSchedule.util");
class UserDBService {
    constructor() {
        this.userRepo = data_source_1.default.getRepository(User_1.User);
        this.authRepo = data_source_1.default.getRepository(AuthProvider_1.AuthProvider);
        this.tokenRepo = data_source_1.default.getRepository(RefreshToken_1.RefreshToken);
        this.billingRepo = data_source_1.default.getRepository(UserBillingDetails_1.UserBillingDetails);
        this.edgingRepo = data_source_1.default.getRepository(UserEdgingStatus_1.UserEdgingStatus);
        this.riskLimitsRepo = data_source_1.default.getRepository(UserRiskLimits_1.UserRiskLimits);
        this.adminStrategyTradeScheduleRepo = data_source_1.default.getRepository(AdminStrategyTradeScheduleSetting_1.AdminStrategyTradeScheduleSetting);
        this.subscriptionRepo = data_source_1.default.getRepository(UserSubscription_1.UserSubscription);
        this.tradingAccountRepo = data_source_1.default.getRepository(UserTradingAccount_1.UserTradingAccount);
        this.tradeSignalRepo = data_source_1.default.getRepository(TradeSignals_1.TradeSignal);
    }
    getManager(manager) {
        return manager ?? this.userRepo.manager;
    }
    parseBoolean(value) {
        return value === true || value === "true";
    }
    mapAdminUserListRow(row) {
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
            referredByUserId: row.referredByUserId === null || row.referredByUserId === undefined
                ? null
                : Number(row.referredByUserId),
            level1ReferralCount: Number(row.level1ReferralCount ?? 0),
            level2ReferralCount: Number(row.level2ReferralCount ?? 0),
        };
    }
    async getReferralUserById(userId) {
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
    async getReferralUsersByParentIds(parentUserIds) {
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
    async ensureSchema() {
        const rows = await data_source_1.default.query(`
      SELECT COUNT(*)::int AS admin_count
      FROM users
      WHERE is_admin = true
        AND deleted_at IS NULL;
    `);
        const adminCount = Number(rows?.[0]?.admin_count ?? 0);
        if (adminCount > 1) {
            throw new Error(`Single admin migration blocked: found ${adminCount} admin users. Demote extras before rollout.`);
        }
        await data_source_1.default.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS referral_code TEXT;
    `);
        await data_source_1.default.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS referred_by_user_id INT;
    `);
        await data_source_1.default.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_users_referral_code_nonnull
      ON users (referral_code)
      WHERE referral_code IS NOT NULL;
    `);
        await data_source_1.default.query(`
      CREATE INDEX IF NOT EXISTS idx_users_referred_by_user_id
      ON users (referred_by_user_id);
    `);
        await data_source_1.default.query(`
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
        await data_source_1.default.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_users_single_active_admin
      ON users ((1))
      WHERE is_admin = true
        AND deleted_at IS NULL;
    `);
        await data_source_1.default.query(`
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
        await data_source_1.default.query(`
      CREATE TABLE IF NOT EXISTS admin_strategy_trade_schedule_settings (
        id INT PRIMARY KEY,
        is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        timezone TEXT NOT NULL DEFAULT '${adminStrategyTradeSchedule_util_1.DEFAULT_ADMIN_STRATEGY_TRADE_SCHEDULE_TIMEZONE}',
        windows JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        await data_source_1.default.query(`
      INSERT INTO admin_strategy_trade_schedule_settings (id, is_enabled, timezone, windows)
      VALUES (1, FALSE, '${adminStrategyTradeSchedule_util_1.DEFAULT_ADMIN_STRATEGY_TRADE_SCHEDULE_TIMEZONE}', '[]'::jsonb)
      ON CONFLICT (id) DO NOTHING;
    `);
    }
    async countAdmins(excludeUserId) {
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
    async findByEmail(email) {
        return this.userRepo.findOne({ where: { email } });
    }
    async findById(id) {
        return this.userRepo.findOne({ where: { id } });
    }
    async findByReferralCode(code) {
        return this.userRepo
            .createQueryBuilder("user")
            .where("user.referral_code = :code", { code })
            .andWhere("user.deleted_at IS NULL")
            .getOne();
    }
    async listUsers(params) {
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
            .addSelect(`
        (
          SELECT COUNT(*)::int
          FROM users level1
          WHERE level1.referred_by_user_id = u.id
            AND level1.deleted_at IS NULL
        )
        `, "level1ReferralCount")
            .addSelect(`
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
        `, "level2ReferralCount")
            .orderBy("u.created_at", "DESC")
            .skip((page - 1) * limit)
            .take(limit)
            .getRawMany();
        return {
            items: items.map((item) => this.mapAdminUserListRow(item)),
            total,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        };
    }
    async getProvider(userId) {
        return this.authRepo.findOne({ where: { userId } });
    }
    async createUser(params) {
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
    async updateAdminStatus(userId, isAdmin) {
        const user = await this.findById(userId);
        if (!user)
            return null;
        user.isAdmin = isAdmin;
        return this.userRepo.save(user);
    }
    async createAuthProvider(user, provider, providerUserId, meta) {
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
    async saveRefreshToken(user, tokenHash, expiresAt) {
        const rt = this.tokenRepo.create({
            user,
            userId: user.id,
            tokenHash,
            expiresAt: expiresAt ?? null,
            revoked: false,
        });
        return this.tokenRepo.save(rt);
    }
    async findRefreshTokenByHash(tokenHash) {
        return this.tokenRepo.findOne({
            where: { tokenHash },
            relations: ["user"],
        });
    }
    async findRefreshTokenForUser(userId, tokenHash) {
        return this.tokenRepo.findOne({
            where: { tokenHash, userId },
            relations: ["user"],
        });
    }
    async revokeRefreshTokenByHash(tokenHash) {
        await this.tokenRepo.update({ tokenHash }, { revoked: true });
    }
    async revokeAllRefreshTokensForUser(userId) {
        await this.tokenRepo.update({ userId }, { revoked: true });
    }
    async setEmailVerificationToken(userId, tokenHash) {
        await this.userRepo.update({ id: userId }, { verificationToken: tokenHash });
    }
    async findByVerificationToken(tokenHash) {
        return this.userRepo.findOne({
            where: {
                verificationToken: tokenHash,
                isEmailVerified: false,
            },
        });
    }
    async markEmailVerified(userId) {
        await this.userRepo.update({ id: userId }, {
            isEmailVerified: true,
            verificationToken: null,
        });
    }
    async getReferralSummaryData(userId) {
        const user = await this.getReferralUserById(userId);
        if (!user) {
            return null;
        }
        let level1Upline = null;
        let level2Upline = null;
        if (user.referredByUserId) {
            level1Upline = await this.getReferralUserById(Number(user.referredByUserId));
            if (level1Upline?.referredByUserId) {
                level2Upline = await this.getReferralUserById(Number(level1Upline.referredByUserId));
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
    async getUserDetails(userId) {
        try {
            let userData = await this.userRepo.findOne({
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
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "user_not_found",
                };
            }
            else {
                return userData;
            }
        }
        catch (error) {
            throw error;
        }
    }
    async getDashboardUserProfile(userId) {
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
    async getDashboardSubscriptions(userId) {
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
    async getDashboardAccounts(userId) {
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
    async getUserSettingsData(userId) {
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
    async getAdminStrategyTradeSchedule() {
        let schedule = await this.adminStrategyTradeScheduleRepo.findOne({
            where: { id: 1 },
        });
        if (!schedule) {
            schedule = this.adminStrategyTradeScheduleRepo.create({
                id: 1,
                isEnabled: false,
                timezone: adminStrategyTradeSchedule_util_1.DEFAULT_ADMIN_STRATEGY_TRADE_SCHEDULE_TIMEZONE,
                windows: [],
            });
            schedule = await this.adminStrategyTradeScheduleRepo.save(schedule);
        }
        return schedule;
    }
    async upsertAdminStrategyTradeSchedule(payload) {
        const schedule = await this.getAdminStrategyTradeSchedule();
        schedule.isEnabled = payload.isEnabled;
        schedule.timezone = payload.timezone;
        schedule.windows = payload.windows;
        return this.adminStrategyTradeScheduleRepo.save(schedule);
    }
    async getDashboardTradeCountsByAccount(userId) {
        const rawRows = await this.tradeSignalRepo
            .createQueryBuilder("ts")
            .innerJoin("ts.tradingAccount", "ta")
            .leftJoin("ts.status", "tss")
            .select("ts.tradingAccountId", "tradingAccountId")
            .addSelect("COALESCE(SUM(CASE WHEN tss.status IN ('pending', 'in_progress', 'completed') THEN 1 ELSE 0 END), 0)", "active")
            .addSelect("COALESCE(SUM(CASE WHEN tss.status IN ('closed', 'pending_close') THEN 1 ELSE 0 END), 0)", "closed")
            .addSelect("COALESCE(SUM(CASE WHEN tss.status = 'failed' THEN 1 ELSE 0 END), 0)", "failed")
            .where("ta.userId = :userId", { userId })
            .groupBy("ts.tradingAccountId")
            .getRawMany();
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
    async getBillingDetails(userId) {
        try {
            return this.billingRepo.findOne({
                where: { userId: String(userId) },
            });
        }
        catch (error) {
            throw error;
        }
    }
    async upsertBillingDetails(userId, payload) {
        try {
            const existing = await this.billingRepo.findOne({
                where: { userId: String(userId) },
            });
            if (existing) {
                // update only provided fields (don’t wipe with undefined)
                Object.entries(payload).forEach(([k, v]) => {
                    if (v !== undefined)
                        existing[k] = v;
                });
                // never allow changing userId
                existing.userId = String(userId);
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
        }
        catch (error) {
            throw error;
        }
    }
    async updateAllTradingAccountsEnabledForUser(userId, isEnabled, manager) {
        await this.getManager(manager)
            .getRepository(UserTradingAccount_1.UserTradingAccount)
            .createQueryBuilder()
            .update(UserTradingAccount_1.UserTradingAccount)
            .set({ isEnabled })
            .where("user_id = :userId", { userId })
            .execute();
    }
    async updateTradeStatus(userId, allowTrade) {
        try {
            return data_source_1.default.transaction(async (manager) => {
                const userRepo = manager.getRepository(User_1.User);
                const user = await userRepo.findOne({ where: { id: userId } });
                if (!user) {
                    throw {
                        statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                        message: "user_not_found",
                    };
                }
                user.allowTrade = allowTrade;
                const updatedUser = await userRepo.save(user);
                await this.updateAllTradingAccountsEnabledForUser(userId, allowTrade, manager);
                return updatedUser;
            });
        }
        catch (error) {
            throw error;
        }
    }
    async updateCopyTradeStatus(userId, allowCopyTrade) {
        try {
            const user = await this.userRepo.findOne({ where: { id: userId } });
            if (!user) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "user_not_found",
                };
            }
            user.allowCopyTrade = allowCopyTrade;
            return this.userRepo.save(user);
        }
        catch (error) {
            throw error;
        }
    }
    async getEdgingStatus(userId) {
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
        }
        catch (error) {
            throw error;
        }
    }
    async getRiskLimits(userId) {
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
        }
        catch (error) {
            throw error;
        }
    }
    async upsertRiskLimits(userId, payload) {
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
            }
            else {
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
            return this.riskLimitsRepo.save(riskLimits);
        }
        catch (error) {
            throw error;
        }
    }
    async upsertEdgingStatus(userId, isEnabled, notes) {
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
            }
            else {
                edging.isEnabled = isEnabled;
                if (notes !== undefined) {
                    edging.notes = notes;
                }
            }
            return this.edgingRepo.save(edging);
        }
        catch (error) {
            throw error;
        }
    }
}
exports.UserDBService = UserDBService;
