"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionPlanDBService = void 0;
// src/app/subscriptionPlan/services/subscriptionPlan.db.ts
const crypto_1 = __importDefault(require("crypto"));
const data_source_1 = __importDefault(require("../../../db/data-source"));
const SubscriptionPlan_1 = require("../../../entity/SubscriptionPlan");
const PlanType_1 = require("../../../entity/PlanType");
const Market_1 = require("../../../entity/Market");
const PlanPricing_1 = require("../../../entity/PlanPricing");
const PlanLimits_1 = require("../../../entity/PlanLimits");
const PlanFeature_1 = require("../../../entity/PlanFeature");
const PlanBundleItem_1 = require("../../../entity/PlanBundleItem");
const PlanStrategy_1 = require("../../../entity/PlanStrategy");
const Strategy_1 = require("../../../entity/Strategy");
const PlanAdminWebhookToken_1 = require("../../../entity/PlanAdminWebhookToken");
const badRequest = (message) => ({ statusCode: 400, message });
class SubscriptionPlanDBService {
    constructor() {
        this.planRepo = data_source_1.default.getRepository(SubscriptionPlan_1.SubscriptionPlan);
        this.adminWebhookTokenRepo = data_source_1.default.getRepository(PlanAdminWebhookToken_1.PlanAdminWebhookToken);
        this.typeRepo = data_source_1.default.getRepository(PlanType_1.PlanType);
        this.marketRepo = data_source_1.default.getRepository(Market_1.Market);
        this.strategyRepo = data_source_1.default.getRepository(Strategy_1.Strategy);
    }
    newAdminWebhookToken() {
        return crypto_1.default.randomBytes(24).toString("hex");
    }
    async ensureSchema() {
        await data_source_1.default.query(`
      ALTER TABLE subscription_plans
      ADD COLUMN IF NOT EXISTS admin_webhook_token TEXT;
    `);
        await data_source_1.default.query(`
      CREATE TABLE IF NOT EXISTS subscription_plan_admin_webhook_tokens (
        id BIGSERIAL PRIMARY KEY,
        plan_id BIGINT NOT NULL UNIQUE REFERENCES subscription_plans(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
        await data_source_1.default.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_plan_admin_webhook_tokens_plan_id
      ON subscription_plan_admin_webhook_tokens(plan_id);
    `);
        await data_source_1.default.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_plan_admin_webhook_tokens_token
      ON subscription_plan_admin_webhook_tokens(token);
    `);
        await data_source_1.default.query(`
      INSERT INTO subscription_plan_admin_webhook_tokens (plan_id, token)
      SELECT id, admin_webhook_token
      FROM subscription_plans
      WHERE admin_webhook_token IS NOT NULL
      ON CONFLICT DO NOTHING;
    `);
        const duplicatePlanStrategies = await data_source_1.default.query(`
      SELECT plan_id, COUNT(*)::int AS strategy_count
      FROM plan_strategies
      GROUP BY plan_id
      HAVING COUNT(*) > 1
      ORDER BY plan_id
      LIMIT 10;
    `);
        if (Array.isArray(duplicatePlanStrategies) && duplicatePlanStrategies.length > 0) {
            console.warn("[SubscriptionPlanDBService.ensureSchema] duplicate plan_strategies rows detected; skipping uq_plan_strategies_plan_id creation until data cleanup is completed", duplicatePlanStrategies.map((row) => ({
                planId: Number(row.plan_id),
                strategyCount: Number(row.strategy_count),
            })));
            return;
        }
        await data_source_1.default.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_plan_strategies_plan_id
      ON plan_strategies(plan_id);
    `);
    }
    async createPlan(payload) {
        const planType = await this.typeRepo.findOne({
            where: { code: payload.planTypeCode },
        });
        if (!planType)
            throw badRequest(`Invalid planTypeCode=${payload.planTypeCode}`);
        const market = payload.marketCode == null
            ? null
            : await this.marketRepo.findOne({ where: { code: payload.marketCode } });
        if (payload.marketCode != null && !market) {
            throw badRequest(`Invalid marketCode=${payload.marketCode}`);
        }
        let strategy = null;
        if (payload.strategyId !== undefined && payload.strategyId !== null) {
            strategy = await this.strategyRepo.findOne({
                where: { id: payload.strategyId },
            });
            if (!strategy)
                throw badRequest(`Invalid strategyId=${payload.strategyId}`);
        }
        return data_source_1.default.transaction(async (trx) => {
            const planRepo = trx.getRepository(SubscriptionPlan_1.SubscriptionPlan);
            // BIGINT ids (SubscriptionPlan.planTypeId/marketId are numbers)
            const plan = planRepo.create({
                name: payload.name.trim(),
                description: payload.description ?? null,
                isActive: payload.isActive ?? true,
                metadata: payload.metadata ?? {},
                planTypeId: planType.id,
                marketId: market ? market.id : null,
            });
            const savedPlan = await planRepo.save(plan);
            // pricing (unique plan_id)
            if (payload.pricing) {
                await trx.getRepository(PlanPricing_1.PlanPricing).save(trx.getRepository(PlanPricing_1.PlanPricing).create({
                    planId: savedPlan.id,
                    priceInr: payload.pricing.priceInr,
                    currency: payload.pricing.currency ?? "INR",
                    interval: payload.pricing.interval ?? "monthly",
                    isFree: payload.pricing.isFree ?? false,
                }));
            }
            // limits (unique plan_id)
            if (payload.limits) {
                await trx.getRepository(PlanLimits_1.PlanLimits).save(trx.getRepository(PlanLimits_1.PlanLimits).create({
                    planId: savedPlan.id,
                    minBalance: payload.limits.minBalance ?? null,
                    maxTradesPerWeek: payload.limits.maxTradesPerWeek ?? null,
                    maxConnectedAccounts: payload.limits.maxConnectedAccounts ?? null,
                    maxDailyTrades: payload.limits.maxDailyTrades ?? null,
                    maxLotPerTrade: payload.limits.maxLotPerTrade != null ? String(payload.limits.maxLotPerTrade) : null,
                    maxCopyMasters: payload.limits.maxCopyMasters ?? null,
                    maxCopyFollowingAccounts: payload.limits.maxCopyFollowingAccounts ?? null,
                    maxCopyFollowersPerMaster: payload.limits.maxCopyFollowersPerMaster ?? null,
                }));
            }
            // features (replace insert)
            if (payload.features && Object.keys(payload.features).length > 0) {
                const featureRepo = trx.getRepository(PlanFeature_1.PlanFeature);
                const rows = Object.entries(payload.features).map(([k, v]) => ({
                    planId: savedPlan.id,
                    featureKey: k,
                    featureValue: String(v),
                }));
                // insert avoids DeepPartial overload issues + is faster
                await featureRepo.insert(rows);
            }
            // strategies mapping (insert bulk)
            if (strategy) {
                const psRepo = trx.getRepository(PlanStrategy_1.PlanStrategy);
                const rows = [{
                        planId: savedPlan.id,
                        strategyId: Number(strategy.id),
                    }];
                await psRepo.insert(rows);
            }
            // bundle items (insert bulk)
            if (payload.bundleItems?.length) {
                const bRepo = trx.getRepository(PlanBundleItem_1.PlanBundleItem);
                const rows = payload.bundleItems.map((bi) => ({
                    bundlePlanId: savedPlan.id,
                    includedPlanId: bi.includedPlanId,
                    quantity: bi.quantity ?? 1,
                }));
                await bRepo.insert(rows);
            }
            return this.getPlanById(savedPlan.id);
        });
    }
    getPlanById(id) {
        return this.planRepo.findOne({
            where: { id },
            relations: {
                planType: true,
                market: true,
                pricing: true,
                limits: true,
                features: true,
                bundleItems: true,
                planStrategies: { strategy: true },
            },
        });
    }
    async updatePlan(id, payload) {
        return data_source_1.default.transaction(async (trx) => {
            const planRepo = trx.getRepository(SubscriptionPlan_1.SubscriptionPlan);
            const updatePlan = {};
            if (payload.name !== undefined)
                updatePlan.name = payload.name.trim();
            if (payload.description !== undefined)
                updatePlan.description = payload.description ?? null;
            if (payload.isActive !== undefined)
                updatePlan.isActive = payload.isActive;
            if (payload.metadata !== undefined)
                updatePlan.metadata = payload.metadata ?? {};
            // planTypeCode -> id
            if (payload.planTypeCode !== undefined) {
                const pt = await trx.getRepository(PlanType_1.PlanType).findOne({
                    where: { code: payload.planTypeCode },
                });
                if (!pt)
                    throw badRequest(`Invalid planTypeCode=${payload.planTypeCode}`);
                updatePlan.planTypeId = pt.id;
            }
            // marketCode -> id / null
            if (payload.marketCode !== undefined) {
                if (payload.marketCode == null) {
                    updatePlan.marketId = null;
                }
                else {
                    const mk = await trx.getRepository(Market_1.Market).findOne({
                        where: { code: payload.marketCode },
                    });
                    if (!mk)
                        throw badRequest(`Invalid marketCode=${payload.marketCode}`);
                    updatePlan.marketId = mk.id;
                }
            }
            let strategy = null;
            if (payload.strategyId !== undefined && payload.strategyId !== null) {
                strategy = await trx.getRepository(Strategy_1.Strategy).findOne({
                    where: { id: payload.strategyId },
                });
                if (!strategy)
                    throw badRequest(`Invalid strategyId=${payload.strategyId}`);
            }
            if (Object.keys(updatePlan).length > 0) {
                await planRepo.update({ id }, updatePlan);
            }
            // pricing upsert
            if (payload.pricing) {
                const pricingRepo = trx.getRepository(PlanPricing_1.PlanPricing);
                const existing = await pricingRepo.findOne({ where: { planId: id } });
                const next = pricingRepo.create({
                    ...(existing ?? {}),
                    planId: id,
                    priceInr: payload.pricing.priceInr ?? existing?.priceInr,
                    currency: payload.pricing.currency ?? existing?.currency ?? "INR",
                    interval: payload.pricing.interval ?? existing?.interval ?? "monthly",
                    isFree: payload.pricing.isFree ?? existing?.isFree ?? false,
                });
                await pricingRepo.save(next);
            }
            // limits upsert
            if (payload.limits) {
                const limitsRepo = trx.getRepository(PlanLimits_1.PlanLimits);
                const existing = await limitsRepo.findOne({ where: { planId: id } });
                const next = limitsRepo.create({
                    ...(existing ?? {}),
                    planId: id,
                    minBalance: payload.limits.minBalance ?? existing?.minBalance ?? null,
                    maxTradesPerWeek: payload.limits.maxTradesPerWeek ?? existing?.maxTradesPerWeek ?? null,
                    maxConnectedAccounts: payload.limits.maxConnectedAccounts ?? existing?.maxConnectedAccounts ?? null,
                    maxDailyTrades: payload.limits.maxDailyTrades ?? existing?.maxDailyTrades ?? null,
                    maxCopyMasters: payload.limits.maxCopyMasters ?? existing?.maxCopyMasters ?? null,
                    maxCopyFollowingAccounts: payload.limits.maxCopyFollowingAccounts ?? existing?.maxCopyFollowingAccounts ?? null,
                    maxCopyFollowersPerMaster: payload.limits.maxCopyFollowersPerMaster ?? existing?.maxCopyFollowersPerMaster ?? null,
                });
                if (payload.limits.maxLotPerTrade !== undefined) {
                    next.maxLotPerTrade =
                        payload.limits.maxLotPerTrade != null ? String(payload.limits.maxLotPerTrade) : null;
                }
                else if (existing) {
                    next.maxLotPerTrade = existing.maxLotPerTrade ?? null;
                }
                await limitsRepo.save(next);
            }
            // features replace-all
            if (payload.features !== undefined) {
                const featureRepo = trx.getRepository(PlanFeature_1.PlanFeature);
                await featureRepo.delete({ planId: id });
                if (payload.features && Object.keys(payload.features).length > 0) {
                    const rows = Object.entries(payload.features).map(([k, v]) => ({
                        planId: id,
                        featureKey: k,
                        featureValue: String(v),
                    }));
                    await featureRepo.insert(rows);
                }
            }
            // strategies replace-all
            if (payload.strategyId !== undefined) {
                const psRepo = trx.getRepository(PlanStrategy_1.PlanStrategy);
                await psRepo.delete({ planId: id });
                if (strategy) {
                    const rows = [{
                            planId: id,
                            strategyId: Number(strategy.id),
                        }];
                    await psRepo.insert(rows);
                }
            }
            // bundle items replace-all
            if (payload.bundleItems !== undefined) {
                const bRepo = trx.getRepository(PlanBundleItem_1.PlanBundleItem);
                await bRepo.delete({ bundlePlanId: id });
                if (payload.bundleItems && payload.bundleItems.length > 0) {
                    const rows = payload.bundleItems.map((bi) => ({
                        bundlePlanId: id,
                        includedPlanId: bi.includedPlanId,
                        quantity: bi.quantity ?? 1,
                    }));
                    await bRepo.insert(rows);
                }
            }
            return true;
        });
    }
    async getPlans(query) {
        const chunkSize = query.chunkSize ?? 10;
        const initialOffset = query.initialOffset ?? 0;
        const qb = this.planRepo
            .createQueryBuilder("p")
            .leftJoinAndSelect("p.planType", "pt")
            .leftJoinAndSelect("p.market", "m")
            .leftJoinAndSelect("p.pricing", "pricing")
            .leftJoinAndSelect("p.limits", "limits")
            .leftJoinAndSelect("p.features", "features")
            .leftJoinAndSelect("p.bundleItems", "bundleItems")
            .leftJoinAndSelect("p.planStrategies", "planStrategies")
            .leftJoinAndSelect("planStrategies.strategy", "strategy")
            .orderBy("p.createdAt", "DESC")
            .skip(initialOffset)
            .take(chunkSize);
        if (typeof query.isActive === "boolean") {
            qb.andWhere("p.isActive = :isActive", { isActive: query.isActive });
        }
        if (query.planTypeCode) {
            qb.andWhere("pt.code = :ptc", { ptc: query.planTypeCode });
        }
        if (query.marketCode !== undefined) {
            const mc = query.marketCode;
            if (mc === "NULL")
                qb.andWhere("p.marketId IS NULL");
            else
                qb.andWhere("m.code = :mc", { mc });
        }
        if (query.searchParam?.trim()) {
            qb.andWhere("p.name ILIKE :s OR p.description ILIKE :s", {
                s: `%${query.searchParam.trim()}%`,
            });
        }
        const [rows, total] = await qb.getManyAndCount();
        return [rows, total];
    }
    async getActivePlans(planTypeCode, marketCode) {
        const qb = this.planRepo
            .createQueryBuilder("p")
            .leftJoin("p.planType", "pt")
            .leftJoin("p.market", "m")
            .where("p.isActive = true")
            .orderBy("p.createdAt", "DESC");
        if (planTypeCode)
            qb.andWhere("pt.code = :ptc", { ptc: planTypeCode });
        if (marketCode)
            qb.andWhere("m.code = :mc", { mc: marketCode });
        return qb.getMany();
    }
    async getAdminWebhookToken(planId) {
        const plan = await this.planRepo.findOne({
            where: { id: planId },
            select: ["id"],
        });
        if (!plan) {
            return null;
        }
        const existing = await this.adminWebhookTokenRepo.findOne({
            where: { planId },
        });
        if (existing?.token) {
            return existing.token;
        }
        const created = this.adminWebhookTokenRepo.create({
            planId,
            token: this.newAdminWebhookToken(),
        });
        const saved = await this.adminWebhookTokenRepo.save(created);
        return saved.token;
    }
    async rotateAdminWebhookToken(planId) {
        const nextToken = this.newAdminWebhookToken();
        const existing = await this.adminWebhookTokenRepo.findOne({
            where: { planId },
        });
        if (!existing) {
            await this.adminWebhookTokenRepo.save(this.adminWebhookTokenRepo.create({
                planId,
                token: nextToken,
            }));
            return nextToken;
        }
        existing.token = nextToken;
        existing.updatedAt = new Date();
        await this.adminWebhookTokenRepo.save(existing);
        return nextToken;
    }
    async findPlanByAdminWebhookToken(token) {
        const tokenRow = await this.adminWebhookTokenRepo
            .createQueryBuilder("planWebhook")
            .leftJoinAndSelect("planWebhook.plan", "plan")
            .leftJoinAndSelect("plan.market", "market")
            .leftJoinAndSelect("plan.planStrategies", "planStrategies")
            .leftJoinAndSelect("planStrategies.strategy", "strategy")
            .where("planWebhook.token = :token", { token })
            .andWhere("plan.is_active = true")
            .getOne();
        return tokenRow?.plan ?? null;
    }
}
exports.SubscriptionPlanDBService = SubscriptionPlanDBService;
