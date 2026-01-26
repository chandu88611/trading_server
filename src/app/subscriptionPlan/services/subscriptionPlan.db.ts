// src/app/subscriptionPlan/services/subscriptionPlan.db.ts
import { Repository } from "typeorm";
import AppDataSource from "../../../db/data-source";

import { SubscriptionPlan } from "../../../entity/SubscriptionPlan";
import { PlanType } from "../../../entity/PlanType";
import { Market } from "../../../entity/Market";
import { PlanPricing } from "../../../entity/PlanPricing";
import { PlanLimits } from "../../../entity/PlanLimits";
import { PlanFeature } from "../../../entity/PlanFeature";
import { PlanBundleItem } from "../../../entity/PlanBundleItem";
import { PlanStrategy } from "../../../entity/PlanStrategy";

import {
  ICreateSubscriptionPlan,
  IQueryPlans,
  IUpdateSubscriptionPlan,
} from "../interfaces/subscriberPlan.interface";

type HttpErr = { statusCode: number; message: string };
const badRequest = (message: string): HttpErr => ({ statusCode: 400, message });

export class SubscriptionPlanDBService {
  private planRepo: Repository<SubscriptionPlan>;
  private typeRepo: Repository<PlanType>;
  private marketRepo: Repository<Market>;

  private pricingRepo: Repository<PlanPricing>;
  private limitsRepo: Repository<PlanLimits>;
  private featureRepo: Repository<PlanFeature>;
  private bundleRepo: Repository<PlanBundleItem>;
  private planStrategyRepo: Repository<PlanStrategy>;

  constructor() {
    this.planRepo = AppDataSource.getRepository(SubscriptionPlan);
    this.typeRepo = AppDataSource.getRepository(PlanType);
    this.marketRepo = AppDataSource.getRepository(Market);

    this.pricingRepo = AppDataSource.getRepository(PlanPricing);
    this.limitsRepo = AppDataSource.getRepository(PlanLimits);
    this.featureRepo = AppDataSource.getRepository(PlanFeature);
    this.bundleRepo = AppDataSource.getRepository(PlanBundleItem);
    this.planStrategyRepo = AppDataSource.getRepository(PlanStrategy);
  }

  async createPlan(payload: ICreateSubscriptionPlan) {
    const planType = await this.typeRepo.findOne({
      where: { code: payload.planTypeCode as any },
    });
    if (!planType) throw badRequest(`Invalid planTypeCode=${payload.planTypeCode}`);

    const market =
      payload.marketCode == null
        ? null
        : await this.marketRepo.findOne({ where: { code: payload.marketCode as any } });

    if (payload.marketCode != null && !market) {
      throw badRequest(`Invalid marketCode=${payload.marketCode}`);
    }

    return AppDataSource.transaction(async (trx) => {
      const planRepo = trx.getRepository(SubscriptionPlan);

      // BIGINT -> string (SubscriptionPlan.planTypeId/marketId are string)
      const plan = planRepo.create({
        name: payload.name.trim(),
        description: payload.description ?? null,
        isActive: payload.isActive ?? true,
        metadata: payload.metadata ?? {},
        planTypeId: String((planType as any).id),
        marketId: market ? String((market as any).id) : null,
      });

      const savedPlan = await planRepo.save(plan);

      // pricing (unique plan_id)
      if (payload.pricing) {
        await trx.getRepository(PlanPricing).save(
          trx.getRepository(PlanPricing).create({
            planId: savedPlan.id,
            priceInr: payload.pricing.priceInr,
            currency: payload.pricing.currency ?? "INR",
            interval: (payload.pricing.interval as any) ?? "monthly",
            isFree: payload.pricing.isFree ?? false,
          })
        );
      }

      // limits (unique plan_id)
      if (payload.limits) {
        await trx.getRepository(PlanLimits).save(
          trx.getRepository(PlanLimits).create({
            planId: savedPlan.id,
            minBalance: payload.limits.minBalance ?? null,
            maxTradesPerWeek: payload.limits.maxTradesPerWeek ?? null,
            maxConnectedAccounts: payload.limits.maxConnectedAccounts ?? null,
            maxDailyTrades: payload.limits.maxDailyTrades ?? null,
            maxLotPerTrade:
              payload.limits.maxLotPerTrade != null ? String(payload.limits.maxLotPerTrade) : null,
            maxCopyMasters: payload.limits.maxCopyMasters ?? null,
            maxCopyFollowingAccounts: payload.limits.maxCopyFollowingAccounts ?? null,
            maxCopyFollowersPerMaster: payload.limits.maxCopyFollowersPerMaster ?? null,
          } as any)
        );
      }

      // features (replace insert)
      if (payload.features && Object.keys(payload.features).length > 0) {
        const featureRepo = trx.getRepository(PlanFeature);

        const rows = Object.entries(payload.features).map(([k, v]) => ({
          planId: savedPlan.id,
          featureKey: k,
          featureValue: String(v),
        }));

        // insert avoids DeepPartial overload issues + is faster
        await featureRepo.insert(rows as any);
      }

      // strategies mapping (insert bulk) ✅ FIXES PlanStrategy[][]
      if (payload.strategyIds?.length) {
        const psRepo = trx.getRepository(PlanStrategy);
        const uniq = Array.from(new Set(payload.strategyIds));

        const rows = uniq.map((sid) => ({
          planId: savedPlan.id,
          strategyId: String(sid), // BIGINT -> string
        }));

        await psRepo.insert(rows as any);
      }

      // bundle items (insert bulk) ✅ FIXES PlanBundleItem[][]
      if (payload.bundleItems?.length) {
        const bRepo = trx.getRepository(PlanBundleItem);

        const rows = payload.bundleItems.map((bi) => ({
          bundlePlanId: savedPlan.id,
          includedPlanId: bi.includedPlanId, // (should be uuid string in your model)
          quantity: bi.quantity ?? 1,
        }));

        await bRepo.insert(rows as any);
      }

      return this.getPlanById(savedPlan.id);
    });
  }

  getPlanById(id: string) {
    return this.planRepo.findOne({
      where: { id },
      relations: {
        planType: true,
        market: true,
        pricing: true,
        limits: true,
        features: true,
        bundleItems: true,
        planStrategies: true,
      },
    });
  }

  async updatePlan(id: string, payload: IUpdateSubscriptionPlan) {
    return AppDataSource.transaction(async (trx) => {
      const planRepo = trx.getRepository(SubscriptionPlan);
      const updatePlan: Partial<SubscriptionPlan> & Record<string, any> = {};

      if (payload.name !== undefined) updatePlan.name = payload.name.trim();
      if (payload.description !== undefined) updatePlan.description = payload.description ?? null;
      if (payload.isActive !== undefined) updatePlan.isActive = payload.isActive;
      if (payload.metadata !== undefined) updatePlan.metadata = payload.metadata ?? {};

      // planTypeCode -> id
      if (payload.planTypeCode !== undefined) {
        const pt = await trx.getRepository(PlanType).findOne({
          where: { code: payload.planTypeCode as any },
        });
        if (!pt) throw badRequest(`Invalid planTypeCode=${payload.planTypeCode}`);
        updatePlan.planTypeId = String((pt as any).id);
      }

      // marketCode -> id / null
      if (payload.marketCode !== undefined) {
        if (payload.marketCode == null) {
          updatePlan.marketId = null;
        } else {
          const mk = await trx.getRepository(Market).findOne({
            where: { code: payload.marketCode as any },
          });
          if (!mk) throw badRequest(`Invalid marketCode=${payload.marketCode}`);
          updatePlan.marketId = String((mk as any).id);
        }
      }

      if (Object.keys(updatePlan).length > 0) {
        await planRepo.update({ id }, updatePlan);
      }

      // pricing upsert
      if (payload.pricing) {
        const pricingRepo = trx.getRepository(PlanPricing);
        const existing = await pricingRepo.findOne({ where: { planId: id } as any });

        const next = pricingRepo.create({
          ...(existing ?? ({} as any)),
          planId: id,
          priceInr: payload.pricing.priceInr ?? existing?.priceInr,
          currency: payload.pricing.currency ?? existing?.currency ?? "INR",
          interval: (payload.pricing.interval as any) ?? (existing as any)?.interval ?? "monthly",
          isFree: payload.pricing.isFree ?? existing?.isFree ?? false,
        });

        await pricingRepo.save(next as any);
      }

      // limits upsert
      if (payload.limits) {
        const limitsRepo = trx.getRepository(PlanLimits);
        const existing = await limitsRepo.findOne({ where: { planId: id } as any });

        const next: any = limitsRepo.create({
          ...(existing ?? ({} as any)),
          planId: id,

          minBalance: payload.limits.minBalance ?? existing?.minBalance ?? null,
          maxTradesPerWeek: payload.limits.maxTradesPerWeek ?? existing?.maxTradesPerWeek ?? null,
          maxConnectedAccounts:
            payload.limits.maxConnectedAccounts ?? existing?.maxConnectedAccounts ?? null,
          maxDailyTrades: payload.limits.maxDailyTrades ?? existing?.maxDailyTrades ?? null,
          maxCopyMasters: payload.limits.maxCopyMasters ?? existing?.maxCopyMasters ?? null,
          maxCopyFollowingAccounts:
            payload.limits.maxCopyFollowingAccounts ?? existing?.maxCopyFollowingAccounts ?? null,
          maxCopyFollowersPerMaster:
            payload.limits.maxCopyFollowersPerMaster ?? existing?.maxCopyFollowersPerMaster ?? null,
        });

        if (payload.limits.maxLotPerTrade !== undefined) {
          next.maxLotPerTrade =
            payload.limits.maxLotPerTrade != null ? String(payload.limits.maxLotPerTrade) : null;
        } else if (existing) {
          next.maxLotPerTrade = (existing as any).maxLotPerTrade ?? null;
        }

        await limitsRepo.save(next);
      }

      // features replace-all
      if (payload.features !== undefined) {
        const featureRepo = trx.getRepository(PlanFeature);
        await featureRepo.delete({ planId: id } as any);

        if (payload.features && Object.keys(payload.features).length > 0) {
          const rows = Object.entries(payload.features).map(([k, v]) => ({
            planId: id,
            featureKey: k,
            featureValue: String(v),
          }));
          await featureRepo.insert(rows as any);
        }
      }

      // strategies replace-all
      if (payload.strategyIds !== undefined) {
        const psRepo = trx.getRepository(PlanStrategy);
        await psRepo.delete({ planId: id } as any);

        if (payload.strategyIds && payload.strategyIds.length > 0) {
          const uniq = Array.from(new Set(payload.strategyIds));
          const rows = uniq.map((sid) => ({
            planId: id,
            strategyId: String(sid),
          }));
          await psRepo.insert(rows as any);
        }
      }

      // bundle items replace-all
      if (payload.bundleItems !== undefined) {
        const bRepo = trx.getRepository(PlanBundleItem);
        await bRepo.delete({ bundlePlanId: id } as any);

        if (payload.bundleItems && payload.bundleItems.length > 0) {
          const rows = payload.bundleItems.map((bi) => ({
            bundlePlanId: id,
            includedPlanId: bi.includedPlanId,
            quantity: bi.quantity ?? 1,
          }));
          await bRepo.insert(rows as any);
        }
      }

      return true;
    });
  }

  async getPlans(query: IQueryPlans) {
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
      .orderBy("p.createdAt", "DESC")
      .skip(initialOffset)
      .take(chunkSize);

    if (typeof query.isActive === "boolean") {
      qb.andWhere("p.isActive = :isActive", { isActive: query.isActive });
    }

    if ((query as any).planTypeCode) {
      qb.andWhere("pt.code = :ptc", { ptc: (query as any).planTypeCode });
    }

    if ((query as any).marketCode !== undefined) {
      const mc = (query as any).marketCode;
      if (mc === "NULL") qb.andWhere("p.marketId IS NULL");
      else qb.andWhere("m.code = :mc", { mc });
    }

    if (query.searchParam?.trim()) {
      qb.andWhere("p.name ILIKE :s OR p.description ILIKE :s", {
        s: `%${query.searchParam.trim()}%`,
      });
    }

    const [rows, total] = await qb.getManyAndCount();
    return [rows, total] as const;
  }

  async getActivePlans(planTypeCode?: string, marketCode?: string) {
    const qb = this.planRepo
      .createQueryBuilder("p")
      .leftJoin("p.planType", "pt")
      .leftJoin("p.market", "m")
      .where("p.isActive = true")
      .orderBy("p.createdAt", "DESC");

    if (planTypeCode) qb.andWhere("pt.code = :ptc", { ptc: planTypeCode });
    if (marketCode) qb.andWhere("m.code = :mc", { mc: marketCode });

    return qb.getMany();
  }
}
