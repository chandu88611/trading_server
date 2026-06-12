// src/app/subscriptionPlan/services/subscriptionPlan.db.ts
import crypto from "crypto";
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
import { Strategy } from "../../../entity/Strategy";
import { PlanAdminWebhookToken } from "../../../entity/PlanAdminWebhookToken";

import {
  ICreateSubscriptionPlan,
  IQueryPlans,
  IUpdateSubscriptionPlan,
} from "../interfaces/subscriberPlan.interface";

type HttpErr = { statusCode: number; message: string };
const badRequest = (message: string): HttpErr => ({ statusCode: 400, message });

export class SubscriptionPlanDBService {
  private planRepo: Repository<SubscriptionPlan>;
  private adminWebhookTokenRepo: Repository<PlanAdminWebhookToken>;
  private typeRepo: Repository<PlanType>;
  private marketRepo: Repository<Market>;
  private strategyRepo: Repository<Strategy>;


  constructor() {
    this.planRepo = AppDataSource.getRepository(SubscriptionPlan);
    this.adminWebhookTokenRepo = AppDataSource.getRepository(PlanAdminWebhookToken);
    this.typeRepo = AppDataSource.getRepository(PlanType);
    this.marketRepo = AppDataSource.getRepository(Market);
    this.strategyRepo = AppDataSource.getRepository(Strategy);

  }

  private newAdminWebhookToken() {
    return crypto.randomBytes(24).toString("hex");
  }

  async ensureSchema() {
    await AppDataSource.query(`
      ALTER TABLE subscription_plans
      ADD COLUMN IF NOT EXISTS admin_webhook_token TEXT;
    `);

    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS subscription_plan_admin_webhook_tokens (
        id BIGSERIAL PRIMARY KEY,
        plan_id BIGINT NOT NULL UNIQUE REFERENCES subscription_plans(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await AppDataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_plan_admin_webhook_tokens_plan_id
      ON subscription_plan_admin_webhook_tokens(plan_id);
    `);

    await AppDataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_plan_admin_webhook_tokens_token
      ON subscription_plan_admin_webhook_tokens(token);
    `);

    await AppDataSource.query(`
      INSERT INTO subscription_plan_admin_webhook_tokens (plan_id, token)
      SELECT id, admin_webhook_token
      FROM subscription_plans
      WHERE admin_webhook_token IS NOT NULL
      ON CONFLICT DO NOTHING;
    `);

    const duplicatePlanStrategies = await AppDataSource.query(`
      SELECT plan_id, COUNT(*)::int AS strategy_count
      FROM plan_strategies
      GROUP BY plan_id
      HAVING COUNT(*) > 1
      ORDER BY plan_id
      LIMIT 10;
    `);

    if (Array.isArray(duplicatePlanStrategies) && duplicatePlanStrategies.length > 0) {
      console.warn(
        "[SubscriptionPlanDBService.ensureSchema] duplicate plan_strategies rows detected; skipping uq_plan_strategies_plan_id creation until data cleanup is completed",
        duplicatePlanStrategies.map((row: { plan_id: string; strategy_count: number }) => ({
          planId: Number(row.plan_id),
          strategyCount: Number(row.strategy_count),
        }))
      );
      return;
    }

    await AppDataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_plan_strategies_plan_id
      ON plan_strategies(plan_id);
    `);
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

    let strategy: Strategy | null = null;
    if (payload.strategyId !== undefined && payload.strategyId !== null) {
      strategy = await this.strategyRepo.findOne({
        where: { id: payload.strategyId as any },
      });
      if (!strategy) throw badRequest(`Invalid strategyId=${payload.strategyId}`);
    }

    return AppDataSource.transaction(async (trx) => {
      const planRepo = trx.getRepository(SubscriptionPlan);

      // BIGINT ids (SubscriptionPlan.planTypeId/marketId are numbers)
      const plan = planRepo.create({
        name: payload.name.trim(),
        description: payload.description ?? null,
        isActive: payload.isActive ?? true,
        metadata: payload.metadata ?? {},
        planTypeId: (planType as any).id,
        marketId: market ? (market as any).id : null,
      } as Partial<SubscriptionPlan>);

      const savedPlan = await planRepo.save(plan as SubscriptionPlan);

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

      // strategies mapping (insert bulk)
      if (strategy) {
        const psRepo = trx.getRepository(PlanStrategy);
        const rows = [{
          planId: savedPlan.id,
          strategyId: Number(strategy.id),
        }];

        await psRepo.insert(rows as any);
      }

      // bundle items (insert bulk)
      if (payload.bundleItems?.length) {
        const bRepo = trx.getRepository(PlanBundleItem);

        const rows = payload.bundleItems.map((bi) => ({
          bundlePlanId: savedPlan.id,
          includedPlanId: bi.includedPlanId,
          quantity: bi.quantity ?? 1,
        }));

        await bRepo.insert(rows as any);
      }

      return this.getPlanById(savedPlan.id);
    });
  }

  getPlanById(id: number) {
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

  async updatePlan(id: number, payload: IUpdateSubscriptionPlan) {
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
        updatePlan.planTypeId = (pt as any).id;
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
          updatePlan.marketId = (mk as any).id;
        }
      }

      let strategy: Strategy | null = null;
      if (payload.strategyId !== undefined && payload.strategyId !== null) {
        strategy = await trx.getRepository(Strategy).findOne({
          where: { id: payload.strategyId as any },
        });
        if (!strategy) throw badRequest(`Invalid strategyId=${payload.strategyId}`);
      }

      if (Object.keys(updatePlan).length > 0) {
        await planRepo.update({ id }, updatePlan as any);
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
      if (payload.strategyId !== undefined) {
        const psRepo = trx.getRepository(PlanStrategy);
        await psRepo.delete({ planId: id } as any);

        if (strategy) {
          const rows = [{
            planId: id,
            strategyId: Number(strategy.id),
          }];
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
      .leftJoinAndSelect("planStrategies.strategy", "strategy")
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

  async getAdminWebhookToken(planId: number) {
    const plan = await this.planRepo.findOne({
      where: { id: planId },
      select: ["id"],
    } as any);
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

  async rotateAdminWebhookToken(planId: number) {
    const nextToken = this.newAdminWebhookToken();
    const existing = await this.adminWebhookTokenRepo.findOne({
      where: { planId },
    });

    if (!existing) {
      await this.adminWebhookTokenRepo.save(
        this.adminWebhookTokenRepo.create({
          planId,
          token: nextToken,
        })
      );
      return nextToken;
    }

    existing.token = nextToken;
    existing.updatedAt = new Date();
    await this.adminWebhookTokenRepo.save(existing);
    return nextToken;
  }

  async findPlanByAdminWebhookToken(token: string) {
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
