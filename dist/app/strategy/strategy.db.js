"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyDBService = void 0;
const data_source_1 = __importDefault(require("../../db/data-source"));
const Strategy_1 = require("../../entity/Strategy");
const constants_1 = require("../../types/constants");
const UserStrategyInstance_1 = require("../../entity/UserStrategyInstance");
const subscriberPlan_enum_1 = require("../subscriptionPlan/enums/subscriberPlan.enum");
const STRATEGY_MUTABLE_FIELDS = new Set([
    "strategyCode",
    "strategy_code",
    "name",
    "description",
    "category",
    "version",
    "defaultParams",
    "default_params",
    "riskProfile",
    "risk_profile",
    "risk",
    "capitalRequirement",
    "capital_requirement",
    "isActive",
    "is_active",
    "isDeprecated",
    "is_deprecated",
    "isCopyable",
    "is_copyable",
]);
function badRequest(message) {
    return { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message };
}
function normalizeStrategyCode(value) {
    const strategyCode = String(value ?? "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 120);
    if (!strategyCode) {
        throw badRequest("strategyCode required");
    }
    return strategyCode;
}
function normalizeBoolean(value, fieldName) {
    if (typeof value === "boolean")
        return value;
    if (typeof value === "string") {
        if (value.toLowerCase() === "true")
            return true;
        if (value.toLowerCase() === "false")
            return false;
    }
    throw badRequest(`${fieldName} must be a boolean`);
}
function normalizeVersion(value) {
    const version = Number(value);
    if (!Number.isInteger(version) || version <= 0) {
        throw badRequest("version must be a positive integer");
    }
    return version;
}
function normalizeCapitalRequirement(value) {
    if (value === undefined || value === null || value === "")
        return null;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
        throw badRequest("capitalRequirement must be a non-negative number");
    }
    return amount.toFixed(2);
}
function normalizeDefaultParams(value) {
    let parsed = value;
    if (typeof value === "string") {
        try {
            parsed = JSON.parse(value);
        }
        catch (_error) {
            throw badRequest("defaultParams must be valid JSON");
        }
    }
    if (parsed === null ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)) {
        throw badRequest("defaultParams must be a JSON object");
    }
    return parsed;
}
function mapDuplicateStrategyCodeError(error) {
    if (error?.code === "23505") {
        throw {
            statusCode: constants_1.HttpStatusCode._CONFLICT,
            message: "strategy_code_already_exists",
        };
    }
    throw error;
}
class StrategyDBService {
    constructor() {
        this.repo = data_source_1.default.getRepository(Strategy_1.Strategy);
        this.userStrategyRepo = data_source_1.default.getRepository(UserStrategyInstance_1.UserStrategyInstance);
    }
    async ensureSchema() {
        await data_source_1.default.query(`
      ALTER TABLE user_subscriptions
      ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;
    `);
        await data_source_1.default.query(`
      CREATE TABLE IF NOT EXISTS user_strategy_instances (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subscription_id BIGINT NOT NULL REFERENCES user_subscriptions(id) ON DELETE CASCADE,
        plan_id BIGINT NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
        strategy_id BIGINT NOT NULL REFERENCES strategies(id) ON DELETE RESTRICT,
        trading_account_id BIGINT REFERENCES user_trading_accounts(id) ON DELETE SET NULL,
        status user_strategy_status NOT NULL DEFAULT 'active',
        strategy_version INT NOT NULL,
        frozen_params JSONB NOT NULL DEFAULT '{}'::jsonb,
        volume NUMERIC(4,2) NOT NULL DEFAULT 0.01,
        activated_at TIMESTAMPTZ DEFAULT now(),
        paused_at TIMESTAMPTZ,
        stopped_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
        await data_source_1.default.query(`
      ALTER TABLE user_strategy_instances
      ADD COLUMN IF NOT EXISTS volume NUMERIC(4,2) NOT NULL DEFAULT 0.01;
    `);
        await data_source_1.default.query(`
      ALTER TABLE user_strategy_instances
      ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;
    `);
        await data_source_1.default.query(`
      ALTER TABLE user_strategy_instances
      ADD COLUMN IF NOT EXISTS stopped_at TIMESTAMPTZ;
    `);
        await data_source_1.default.query(`
      ALTER TABLE user_strategy_instances
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
    `);
        await data_source_1.default.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_user_strategy_subscription_strategy
      ON user_strategy_instances(subscription_id, strategy_id);
    `);
        await data_source_1.default.query(`
      ALTER TABLE trade_signals
      ADD COLUMN IF NOT EXISTS strategy_id BIGINT REFERENCES strategies(id) ON DELETE SET NULL;
    `);
        await data_source_1.default.query(`
      CREATE INDEX IF NOT EXISTS idx_trade_signals_strategy_created_at
      ON trade_signals(strategy_id, created_at DESC);
    `);
    }
    async create(payload) {
        if (!payload?.name?.trim())
            throw badRequest("name required");
        if (!payload?.category?.trim())
            throw badRequest("category required");
        const strategyCode = normalizeStrategyCode(payload.strategyCode ?? payload.strategy_code ?? payload.name);
        const row = this.repo.create({
            strategyCode,
            name: payload.name.trim(),
            description: payload.description ?? null,
            category: payload.category.trim(),
            version: payload.version === undefined ? 1 : normalizeVersion(payload.version),
            defaultParams: payload.defaultParams !== undefined || payload.default_params !== undefined
                ? normalizeDefaultParams(payload.defaultParams ?? payload.default_params)
                : {},
            riskProfile: payload.riskProfile ?? payload.risk_profile ?? payload.risk ?? null,
            capitalRequirement: normalizeCapitalRequirement(payload.capitalRequirement ?? payload.capital_requirement),
            isActive: payload.isActive === undefined && payload.is_active === undefined
                ? true
                : normalizeBoolean(payload.isActive ?? payload.is_active, "isActive"),
            isDeprecated: payload.isDeprecated === undefined && payload.is_deprecated === undefined
                ? false
                : normalizeBoolean(payload.isDeprecated ?? payload.is_deprecated, "isDeprecated"),
            isCopyable: payload.isCopyable === undefined && payload.is_copyable === undefined
                ? true
                : normalizeBoolean(payload.isCopyable ?? payload.is_copyable, "isCopyable"),
        });
        try {
            return await this.repo.save(row);
        }
        catch (error) {
            mapDuplicateStrategyCodeError(error);
        }
    }
    async list(query) {
        const chunkSize = Math.min(Math.max(Number(query.chunkSize ?? 20), 1), 100);
        const initialOffset = Math.max(Number(query.initialOffset ?? 0), 0);
        const qb = this.repo
            .createQueryBuilder("strategy")
            .orderBy("strategy.created_at", "DESC")
            .skip(initialOffset)
            .take(chunkSize);
        if (query.availableOnly) {
            qb.andWhere("strategy.is_active = true");
            qb.andWhere("strategy.is_deprecated = false");
        }
        else {
            if (typeof query.isActive === "boolean") {
                qb.andWhere("strategy.is_active = :isActive", {
                    isActive: query.isActive,
                });
            }
            if (typeof query.isDeprecated === "boolean") {
                qb.andWhere("strategy.is_deprecated = :isDeprecated", {
                    isDeprecated: query.isDeprecated,
                });
            }
        }
        if (query.category?.trim()) {
            qb.andWhere("strategy.category = :category", {
                category: query.category.trim(),
            });
        }
        if (query.searchParam?.trim()) {
            qb.andWhere("(strategy.name ILIKE :search OR strategy.description ILIKE :search OR strategy.strategy_code ILIKE :search)", { search: `%${query.searchParam.trim()}%` });
        }
        const [rows, total] = await qb.getManyAndCount();
        return { rows, total };
    }
    async getById(strategyId, options) {
        if (!Number.isFinite(strategyId) || strategyId <= 0) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "invalid_strategy_id" };
        }
        const strategy = await this.repo.findOne({
            where: { id: strategyId },
        });
        if (!strategy ||
            (options?.availableOnly &&
                (!strategy.isActive || strategy.isDeprecated))) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "strategy_not_found" };
        }
        return strategy;
    }
    async getDetail(strategyId, options) {
        const strategy = await this.getById(strategyId, options);
        const metricsRows = await this.repo.manager.query(`
      SELECT
        COUNT(*)::int AS "totalTrades",
        COUNT(*) FILTER (WHERE ts.created_at >= NOW() - INTERVAL '30 days')::int AS "trades30d",
        COUNT(DISTINCT DATE_TRUNC('week', ts.created_at))::int AS "activeWeeks",
        COALESCE(SUM(COALESCE(ts.price, 0) * COALESCE(ts.volume, 0) *
          CASE WHEN UPPER(ts.action) IN ('SELL','SHORT','CLOSE') THEN 1 ELSE -1 END
        ), 0) AS "roiAll",
        COALESCE(SUM(COALESCE(ts.price, 0) * COALESCE(ts.volume, 0) *
          CASE WHEN UPPER(ts.action) IN ('SELL','SHORT','CLOSE') THEN 1 ELSE -1 END
        ) FILTER (WHERE ts.created_at >= NOW() - INTERVAL '30 days'), 0) AS "roi30d",
        COUNT(*) FILTER (WHERE COALESCE(ts.price, 0) * COALESCE(ts.volume, 0) *
          CASE WHEN UPPER(ts.action) IN ('SELL','SHORT','CLOSE') THEN 1 ELSE -1 END > 0)::int AS "winningTrades",
        MIN(ts.created_at) AS since
      FROM trade_signals ts
      LEFT JOIN trade_signals_status tss ON tss.signal_id = ts.id
      WHERE ts.strategy_id = $1
        AND (tss.status IS NULL OR tss.status IN ('completed', 'closed', 'executed'))
      `, [strategyId]);
        const metrics = metricsRows[0] ?? {};
        const totalTrades = Number(metrics.totalTrades ?? 0);
        const activeWeeks = Math.max(Number(metrics.activeWeeks ?? 0), 1);
        const roiAll = Number(metrics.roiAll ?? 0);
        const roi30d = Number(metrics.roi30d ?? 0);
        const equityCurve = await this.repo.manager.query(`
      SELECT DATE_TRUNC('day', ts.created_at) AS date,
             SUM(COALESCE(ts.price, 0) * COALESCE(ts.volume, 0) *
               CASE WHEN UPPER(ts.action) IN ('SELL','SHORT','CLOSE') THEN 1 ELSE -1 END
             ) AS pnl,
             COUNT(*)::int AS trades
      FROM trade_signals ts
      LEFT JOIN trade_signals_status tss ON tss.signal_id = ts.id
      WHERE ts.strategy_id = $1
        AND ts.created_at >= NOW() - INTERVAL '90 days'
        AND (tss.status IS NULL OR tss.status IN ('completed', 'closed', 'executed'))
      GROUP BY DATE_TRUNC('day', ts.created_at)
      ORDER BY date ASC
      `, [strategyId]);
        const instance = options?.userId
            ? await this.getCurrentUserInstance(Number(options.userId), strategyId)
            : null;
        return {
            ...strategy,
            provider: strategy.defaultParams?.provider ?? null,
            riskLevel: strategy.riskProfile ?? strategy.defaultParams?.riskLevel ?? null,
            since: metrics.since ?? strategy.createdAt,
            roi30d,
            roiAll,
            winRate: totalTrades > 0 ? Number(((Number(metrics.winningTrades ?? 0) / totalTrades) * 100).toFixed(2)) : 0,
            maxDrawdown: 0,
            avgTradesPerWeek: Number((totalTrades / activeWeeks).toFixed(2)),
            metrics: {
                totalTrades,
                trades30d: Number(metrics.trades30d ?? 0),
                activeWeeks,
            },
            equityCurve: equityCurve.map((row) => ({
                date: row.date,
                pnl: Number(row.pnl ?? 0),
                trades: Number(row.trades ?? 0),
            })),
            currentUserInstance: instance,
        };
    }
    async getCurrentUserInstance(userId, strategyId) {
        const rows = await this.repo.manager.query(`
      SELECT i.id, i.subscription_id AS "subscriptionId", i.plan_id AS "planId",
             i.strategy_id AS "strategyId", i.trading_account_id AS "tradingAccountId",
             i.status, i.volume, i.frozen_params AS "frozenParams",
             i.activated_at AS "activatedAt", i.updated_at AS "updatedAt"
      FROM user_strategy_instances i
      INNER JOIN user_subscriptions us ON us.id = i.subscription_id
      WHERE i.user_id = $1
        AND i.strategy_id = $2
        AND us.status_v2 = 'active'
      ORDER BY i.updated_at DESC
      LIMIT 1
      `, [userId, strategyId]);
        return rows[0] ?? null;
    }
    async ensureTradingAccount(userId, tradingAccountId) {
        if (!tradingAccountId)
            return null;
        const rows = await this.repo.manager.query(`
      SELECT id
      FROM user_trading_accounts
      WHERE id = $1
        AND user_id = $2
        AND is_enabled = true
      `, [tradingAccountId, userId]);
        if (!rows[0]) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "invalid_trading_account" };
        }
        return Number(rows[0].id);
    }
    normalizeCopySettings(payload) {
        const allocationMode = String(payload.allocationMode ?? payload.allocation_mode ?? "multiplier");
        return {
            autoCopy: payload.autoCopy ?? payload.auto_copy ?? true,
            allocationMode,
            fixed: payload.fixed ?? null,
            percent: payload.percent ?? null,
            multiplier: payload.multiplier ?? null,
            maxRisk: payload.maxRisk ?? payload.max_risk ?? null,
            dailyLossLimit: payload.dailyLossLimit ?? payload.daily_loss_limit ?? null,
            maxDrawdownStop: payload.maxDrawdownStop ?? payload.max_drawdown_stop ?? null,
            maxSlippage: payload.maxSlippage ?? payload.max_slippage ?? null,
        };
    }
    normalizeVolume(payload, fallback) {
        const candidate = payload.volume ?? payload.multiplier;
        if (candidate === undefined || candidate === null || candidate === "") {
            return Number(fallback ?? 0.01).toFixed(2);
        }
        const volume = Number(candidate);
        if (!Number.isFinite(volume) || volume < 0.01 || volume > 99.99) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "volume_must_be_between_0.01_and_99.99" };
        }
        return volume.toFixed(2);
    }
    async subscribe(userId, strategyId, payload) {
        if (!Number.isFinite(userId) || userId <= 0) {
            throw { statusCode: constants_1.HttpStatusCode._UNAUTHORISED, message: "user_not_authorized" };
        }
        await this.getById(strategyId, { availableOnly: true });
        const tradingAccountId = payload.accountId ?? payload.tradingAccountId ?? payload.trading_account_id;
        const validatedAccountId = await this.ensureTradingAccount(userId, tradingAccountId === undefined || tradingAccountId === null || tradingAccountId === ""
            ? null
            : Number(tradingAccountId));
        const existingRows = await this.repo.manager.query(`
      SELECT i.*, s.default_params, s.version
      FROM user_strategy_instances i
      INNER JOIN user_subscriptions us ON us.id = i.subscription_id
      INNER JOIN strategies s ON s.id = i.strategy_id
      WHERE i.user_id = $1
        AND i.strategy_id = $2
        AND us.status_v2 = 'active'
      ORDER BY i.updated_at DESC
      LIMIT 1
      `, [userId, strategyId]);
        let instance = existingRows[0];
        if (!instance) {
            const subscriptionRows = await this.repo.manager.query(`
        SELECT us.id AS subscription_id, us.plan_id, s.version, s.default_params
        FROM user_subscriptions us
        INNER JOIN plan_strategies ps ON ps.plan_id = us.plan_id AND ps.strategy_id = $2
        INNER JOIN strategies s ON s.id = ps.strategy_id
        WHERE us.user_id = $1
          AND us.status_v2 = 'active'
        ORDER BY us.created_at DESC
        LIMIT 1
        `, [userId, strategyId]);
            const subscription = subscriptionRows[0];
            if (!subscription) {
                throw {
                    statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "active_strategy_subscription_not_found",
                };
            }
            const inserted = await this.repo.manager.query(`
        INSERT INTO user_strategy_instances(
          user_id, subscription_id, plan_id, strategy_id, trading_account_id,
          status, strategy_version, frozen_params, volume, activated_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 'active', $6, $7::jsonb, $8, now(), now())
        RETURNING *
        `, [
                userId,
                subscription.subscription_id,
                subscription.plan_id,
                strategyId,
                validatedAccountId,
                subscription.version,
                JSON.stringify(subscription.default_params ?? {}),
                "0.01",
            ]);
            instance = inserted[0];
        }
        const frozenParams = {
            ...(instance.frozen_params ?? {}),
            copySettings: this.normalizeCopySettings(payload ?? {}),
        };
        const rows = await this.repo.manager.query(`
      UPDATE user_strategy_instances
      SET trading_account_id = $3,
          frozen_params = $4::jsonb,
          volume = $5,
          status = 'active',
          paused_at = NULL,
          stopped_at = NULL,
          updated_at = now()
      WHERE id = $1 AND user_id = $2
      RETURNING id, subscription_id AS "subscriptionId", plan_id AS "planId",
                strategy_id AS "strategyId", trading_account_id AS "tradingAccountId",
                status, volume, frozen_params AS "frozenParams",
                activated_at AS "activatedAt", updated_at AS "updatedAt"
      `, [
            instance.id,
            userId,
            validatedAccountId ?? instance.trading_account_id ?? null,
            JSON.stringify(frozenParams),
            this.normalizeVolume(payload ?? {}, instance.volume),
        ]);
        return rows[0];
    }
    async getMyPerformance(userId, strategyId, accountId) {
        if (!Number.isFinite(userId) || userId <= 0) {
            throw { statusCode: constants_1.HttpStatusCode._UNAUTHORISED, message: "user_not_authorized" };
        }
        await this.getById(strategyId, { availableOnly: true });
        if (accountId !== undefined && accountId !== null) {
            await this.ensureTradingAccount(userId, accountId);
        }
        const accountFilter = accountId ? "AND ts.trading_account_id = $3" : "";
        const params = accountId ? [userId, strategyId, accountId] : [userId, strategyId];
        const summaryRows = await this.repo.manager.query(`
      SELECT
        COUNT(*)::int AS "tradesCopied",
        COUNT(*) FILTER (WHERE tss.status IN ('completed', 'closed', 'executed'))::int AS "completedTrades",
        COUNT(*) FILTER (WHERE tss.status IN ('pending', 'in_progress'))::int AS "openTrades",
        COALESCE(SUM(COALESCE(ts.price, 0) * COALESCE(ts.volume, 0) *
          CASE WHEN UPPER(ts.action) IN ('SELL','SHORT','CLOSE') THEN 1 ELSE -1 END
        ) FILTER (WHERE tss.status IN ('completed', 'closed', 'executed')), 0) AS "realizedPnl",
        COALESCE(SUM(COALESCE(ts.price, 0) * COALESCE(ts.volume, 0) *
          CASE WHEN UPPER(ts.action) IN ('SELL','SHORT','CLOSE') THEN 1 ELSE -1 END
        ) FILTER (WHERE tss.status IN ('pending', 'in_progress')), 0) AS "unrealizedPnl"
      FROM trade_signals ts
      LEFT JOIN trade_signals_status tss ON tss.signal_id = ts.id
      WHERE ts.user_id = $1
        AND ts.strategy_id = $2
        ${accountFilter}
      `, params);
        const daily = await this.repo.manager.query(`
      SELECT DATE_TRUNC('day', ts.created_at) AS date,
             SUM(COALESCE(ts.price, 0) * COALESCE(ts.volume, 0) *
               CASE WHEN UPPER(ts.action) IN ('SELL','SHORT','CLOSE') THEN 1 ELSE -1 END
             ) AS pnl,
             COUNT(*)::int AS trades
      FROM trade_signals ts
      LEFT JOIN trade_signals_status tss ON tss.signal_id = ts.id
      WHERE ts.user_id = $1
        AND ts.strategy_id = $2
        ${accountFilter}
      GROUP BY DATE_TRUNC('day', ts.created_at)
      ORDER BY date ASC
      `, params);
        const recentTrades = await this.repo.manager.query(`
      SELECT ts.id, ts.action, ts.symbol, ts.exchange, ts.price, ts.volume,
             ts.trading_account_id AS "tradingAccountId", tss.status,
             ts.created_at AS "createdAt"
      FROM trade_signals ts
      LEFT JOIN trade_signals_status tss ON tss.signal_id = ts.id
      WHERE ts.user_id = $1
        AND ts.strategy_id = $2
        ${accountFilter}
      ORDER BY ts.created_at DESC
      LIMIT 20
      `, params);
        const summary = summaryRows[0] ?? {};
        return {
            realizedPnl: Number(summary.realizedPnl ?? 0),
            unrealizedPnl: Number(summary.unrealizedPnl ?? 0),
            tradesCopied: Number(summary.tradesCopied ?? 0),
            completedTrades: Number(summary.completedTrades ?? 0),
            openTrades: Number(summary.openTrades ?? 0),
            equityCurve: daily.map((row) => ({
                date: row.date,
                pnl: Number(row.pnl ?? 0),
                trades: Number(row.trades ?? 0),
            })),
            recentTrades,
        };
    }
    async update(strategyId, payload) {
        if (!Number.isFinite(strategyId) || strategyId <= 0) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "invalid_strategy_id" };
        }
        if (!payload || typeof payload !== "object") {
            throw badRequest("strategy update payload required");
        }
        const hasMutableField = Object.keys(payload).some((key) => STRATEGY_MUTABLE_FIELDS.has(key));
        if (!hasMutableField) {
            throw badRequest("no_strategy_fields_to_update");
        }
        const strategy = await this.repo.findOne({
            where: { id: strategyId },
        });
        if (!strategy) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "strategy_not_found" };
        }
        if (payload.strategyCode !== undefined || payload.strategy_code !== undefined) {
            strategy.strategyCode = normalizeStrategyCode(payload.strategyCode ?? payload.strategy_code);
        }
        if (payload.name !== undefined) {
            if (!String(payload.name).trim())
                throw badRequest("name cannot be empty");
            strategy.name = String(payload.name).trim();
        }
        if (payload.description !== undefined) {
            strategy.description =
                payload.description === null ? null : String(payload.description);
        }
        if (payload.category !== undefined) {
            if (!String(payload.category).trim()) {
                throw badRequest("category cannot be empty");
            }
            strategy.category = String(payload.category).trim();
        }
        if (payload.version !== undefined) {
            strategy.version = normalizeVersion(payload.version);
        }
        if (payload.defaultParams !== undefined || payload.default_params !== undefined) {
            strategy.defaultParams = normalizeDefaultParams(payload.defaultParams ?? payload.default_params);
        }
        if (payload.riskProfile !== undefined ||
            payload.risk_profile !== undefined ||
            payload.risk !== undefined) {
            const risk = payload.riskProfile !== undefined
                ? payload.riskProfile
                : payload.risk_profile !== undefined
                    ? payload.risk_profile
                    : payload.risk;
            strategy.riskProfile = risk === null ? null : String(risk);
        }
        if (payload.capitalRequirement !== undefined ||
            payload.capital_requirement !== undefined) {
            strategy.capitalRequirement = normalizeCapitalRequirement(payload.capitalRequirement ?? payload.capital_requirement);
        }
        if (payload.isActive !== undefined || payload.is_active !== undefined) {
            strategy.isActive = normalizeBoolean(payload.isActive ?? payload.is_active, "isActive");
        }
        if (payload.isDeprecated !== undefined ||
            payload.is_deprecated !== undefined) {
            strategy.isDeprecated = normalizeBoolean(payload.isDeprecated ?? payload.is_deprecated, "isDeprecated");
        }
        if (payload.isCopyable !== undefined || payload.is_copyable !== undefined) {
            strategy.isCopyable = normalizeBoolean(payload.isCopyable ?? payload.is_copyable, "isCopyable");
        }
        try {
            return await this.repo.save(strategy);
        }
        catch (error) {
            mapDuplicateStrategyCodeError(error);
        }
    }
    async retire(strategyId) {
        if (!Number.isFinite(strategyId) || strategyId <= 0) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "invalid_strategy_id" };
        }
        const rows = await this.repo.manager.query(`
      UPDATE strategies
      SET is_active = false,
          is_deprecated = true,
          updated_at = now()
      WHERE id = $1
      RETURNING id, strategy_code, name, is_active, is_deprecated, updated_at
      `, [strategyId]);
        const row = rows?.[0];
        if (!row) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "strategy_not_found" };
        }
        return row;
    }
    async setStrategyActive(strategyId, isActive) {
        if (!Number.isFinite(strategyId) || strategyId <= 0) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "invalid_strategy_id" };
        }
        const rows = await this.repo.manager.query(`
      UPDATE strategies
      SET is_active = $2,
          is_deprecated = CASE WHEN $2 = true THEN false ELSE is_deprecated END,
          updated_at = now()
      WHERE id = $1
      RETURNING id, strategy_code, name, is_active, is_deprecated, updated_at
      `, [strategyId, isActive]);
        const row = rows?.[0];
        if (!row) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "strategy_not_found" };
        }
        return row;
    }
    async setUserStrategyInstanceStatus(userId, instanceId, status) {
        if (!Number.isFinite(userId) || userId <= 0) {
            throw { statusCode: constants_1.HttpStatusCode._UNAUTHORISED, message: "user_not_authorized" };
        }
        if (!Number.isFinite(instanceId) || instanceId <= 0) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "invalid_instance_id" };
        }
        const instance = await this.userStrategyRepo.findOne({
            where: { id: instanceId, userId },
            relations: {
                strategy: true,
            },
        });
        if (!instance) {
            throw {
                statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                message: "user_strategy_instance_not_found",
            };
        }
        instance.status =
            status === "active" ? subscriberPlan_enum_1.UserStrategyStatus.ACTIVE : subscriberPlan_enum_1.UserStrategyStatus.PAUSED;
        instance.pausedAt = status === "paused" ? new Date() : null;
        if (status === "active") {
            instance.stoppedAt = null;
        }
        return this.userStrategyRepo.save(instance);
    }
    async setUserStrategyStatusByStrategyId(userId, strategyId, status) {
        if (!Number.isFinite(userId) || userId <= 0) {
            throw { statusCode: constants_1.HttpStatusCode._UNAUTHORISED, message: "user_not_authorized" };
        }
        if (!Number.isFinite(strategyId) || strategyId <= 0) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "invalid_strategy_id" };
        }
        const instances = await this.userStrategyRepo
            .createQueryBuilder("instance")
            .leftJoinAndSelect("instance.strategy", "strategy")
            .innerJoinAndSelect("instance.subscription", "subscription")
            .where("instance.user_id = :userId", { userId })
            .andWhere("instance.strategy_id = :strategyId", { strategyId })
            .andWhere("subscription.status_v2 = :subscriptionStatus", {
            subscriptionStatus: subscriberPlan_enum_1.SubscriptionStatus.ACTIVE,
        })
            .orderBy("instance.created_at", "DESC")
            .getMany();
        if (!instances.length) {
            throw {
                statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                message: "user_strategy_instance_not_found",
            };
        }
        for (const instance of instances) {
            instance.status =
                status === "active" ? subscriberPlan_enum_1.UserStrategyStatus.ACTIVE : subscriberPlan_enum_1.UserStrategyStatus.PAUSED;
            instance.pausedAt = status === "paused" ? new Date() : null;
            if (status === "active") {
                instance.stoppedAt = null;
            }
        }
        const saved = await this.userStrategyRepo.save(instances);
        return saved.length === 1
            ? saved[0]
            : {
                strategyId,
                updatedCount: saved.length,
                instances: saved,
            };
    }
    async setUserStrategyInstanceVolume(userId, instanceId, volume) {
        if (!Number.isFinite(userId) || userId <= 0) {
            throw { statusCode: constants_1.HttpStatusCode._UNAUTHORISED, message: "user_not_authorized" };
        }
        if (!Number.isFinite(instanceId) || instanceId <= 0) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "invalid_instance_id" };
        }
        if (!Number.isFinite(volume) || volume < 0.01 || volume > 0.1) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "volume_must_be_between_0.01_and_0.1",
            };
        }
        const instance = await this.userStrategyRepo.findOne({
            where: { id: instanceId, userId },
            relations: {
                strategy: true,
            },
        });
        if (!instance) {
            throw {
                statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                message: "user_strategy_instance_not_found",
            };
        }
        instance.volume = volume.toFixed(2);
        return this.userStrategyRepo.save(instance);
    }
}
exports.StrategyDBService = StrategyDBService;
