"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionPlanDBService = void 0;
const data_source_1 = __importDefault(require("../../../db/data-source"));
const SubscriptionPlan_1 = require("../../../entity/SubscriptionPlan");
const PlanType_1 = require("../../../entity/PlanType");
const Market_1 = require("../../../entity/Market");
const PlanPricing_1 = require("../../../entity/PlanPricing");
const PlanLimits_1 = require("../../../entity/PlanLimits");
const PlanFeature_1 = require("../../../entity/PlanFeature");
const PlanBundleItem_1 = require("../../../entity/PlanBundleItem");
const PlanStrategy_1 = require("../../../entity/PlanStrategy");
const badRequest = (message) => ({ statusCode: 400, message });
class SubscriptionPlanDBService {
    constructor() {
        this.planRepo = data_source_1.default.getRepository(SubscriptionPlan_1.SubscriptionPlan);
        this.typeRepo = data_source_1.default.getRepository(PlanType_1.PlanType);
        this.marketRepo = data_source_1.default.getRepository(Market_1.Market);
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
            if (payload.strategyIds?.length) {
                const psRepo = trx.getRepository(PlanStrategy_1.PlanStrategy);
                const uniq = Array.from(new Set(payload.strategyIds));
                const rows = uniq.map((sid) => ({
                    planId: savedPlan.id,
                    strategyId: sid,
                }));
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
            if (payload.strategyIds !== undefined) {
                const psRepo = trx.getRepository(PlanStrategy_1.PlanStrategy);
                await psRepo.delete({ planId: id });
                if (payload.strategyIds && payload.strategyIds.length > 0) {
                    const uniq = Array.from(new Set(payload.strategyIds));
                    const rows = uniq.map((sid) => ({
                        planId: id,
                        strategyId: sid,
                    }));
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
}
exports.SubscriptionPlanDBService = SubscriptionPlanDBService;
