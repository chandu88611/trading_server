// src/app/subscriptionPlan/services/subscriptionPlan.ts
import { HttpStatusCode } from "../../../types/constants";
import { UserSubscriptionDBService } from "../../userSubscription/services/userSubscription.db";
import {
  ICreateSubscriptionPlan,
  IQueryPlans,
  IUpdateSubscriptionPlan,
} from "../interfaces/subscriberPlan.interface";
import { normalizePlanStrategies } from "../utils/planStrategy";
import { SubscriptionPlanDBService } from "./subscriptionPlan.db";

export class SubscriptionPlanService {
  private db: SubscriptionPlanDBService;
  private userSubscriptionDb: UserSubscriptionDBService;

  constructor() {
    this.db = new SubscriptionPlanDBService();
    this.userSubscriptionDb = new UserSubscriptionDBService();
  }

  async ensureSchema() {
    await this.db.ensureSchema();
  }

  private resolveStrategyId(payload: Record<string, any>): number | null | undefined {
    if (payload.strategyId !== undefined) {
      return payload.strategyId === null ? null : Number(payload.strategyId);
    }

    if (payload.strategyIds !== undefined) {
      if (!Array.isArray(payload.strategyIds)) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "strategyIds must be an array",
        };
      }
      if (payload.strategyIds.length > 1) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "only_one_strategy_per_plan",
        };
      }
      if (payload.strategyIds.length === 1) {
        return Number(payload.strategyIds[0]);
      }
      return null;
    }

    return undefined;
  }

  private attachSingleStrategy<T extends { planStrategies?: Array<{ strategy?: any }> }>(
    plan: T
  ) {
    const planStrategies = normalizePlanStrategies(plan.planStrategies).slice(0, 1);
    const strategy = planStrategies[0]?.strategy
      ? {
          id: Number(planStrategies[0].strategy.id),
          strategyCode: planStrategies[0].strategy.strategyCode,
          name: planStrategies[0].strategy.name,
          isActive: Boolean(planStrategies[0].strategy.isActive),
        }
      : null;

    return Object.assign(plan as any, {
      planStrategies,
      strategy,
    });
  }

  async createPlan(payload: ICreateSubscriptionPlan) {
    if (!payload.name?.trim()) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "name is required" };
    }
    if (!payload.planTypeCode) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "planTypeCode is required" };
    }

    // pricing validation if provided
    if (payload.pricing) {
      if (payload.pricing.priceInr == null || payload.pricing.priceInr < 0) {
        throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "pricing.priceInr must be >= 0" };
      }
    }

    const strategyId = this.resolveStrategyId(payload as any);

    const created = await this.db.createPlan({
      ...payload,
      name: payload.name.trim(),
      description: payload.description ?? null,
      metadata: payload.metadata ?? {},
      isActive: payload.isActive ?? true,
      strategyId,
    });

    return created ? this.attachSingleStrategy(created as any) : created;
  }

  async getPlan(id: number) {
    if (!id || isNaN(id)) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "Invalid planId" };
    }
    const plan = await this.db.getPlanById(id);
    if (!plan) {
      throw { statusCode: HttpStatusCode._NOT_FOUND, message: "Plan not found" };
    }
    return this.attachSingleStrategy(plan as any);
  }

  async updatePlan(id: number, payload: IUpdateSubscriptionPlan) {
    if (!id || isNaN(id)) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "Invalid planId" };
    }

    const existing = await this.db.getPlanById(id);
    if (!existing) {
      throw { statusCode: HttpStatusCode._NOT_FOUND, message: "Plan not found" };
    }

    if (payload.name !== undefined && !payload.name.trim()) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "name cannot be empty" };
    }

    const strategyId = this.resolveStrategyId(payload as any);

    await this.db.updatePlan(id, {
      ...payload,
      name: payload.name?.trim(),
      description: payload.description ?? undefined,
      strategyId,
    });

    return true;
  }

  async deactivatePlan(id: number) {
    if (!id || isNaN(id)) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "Invalid planId" };
    }

    const plan = await this.db.getPlanById(id);
    if (!plan) {
      throw { statusCode: HttpStatusCode._NOT_FOUND, message: "Plan not found" };
    }

    await this.db.updatePlan(id, { isActive: false });
    return true;
  }

  async getPlans(query: IQueryPlans, viewerUserId?: number | null) {
    const [rows, total] = await this.db.getPlans(query);

    let subscriberActivePlanIds: number[] = [];
    if (viewerUserId && Number.isFinite(viewerUserId) && viewerUserId > 0) {
      const activeSubscriptions = await this.userSubscriptionDb.getActiveSubscription(
        viewerUserId
      );
      subscriberActivePlanIds = Array.from(
        new Set(
          (activeSubscriptions || [])
            .map((subscription: any) => Number(subscription.planId))
            .filter((planId) => Number.isFinite(planId) && planId > 0)
        )
      );
    }

    const activePlanIdSet = new Set(subscriberActivePlanIds);
    const enrichedRows = rows.map((plan: any) =>
      Object.assign(this.attachSingleStrategy(plan), {
        subscriberAlreadyHasPlan: activePlanIdSet.has(Number(plan.id)),
      })
    );

    return {
      rows: enrichedRows,
      total,
      subscriberHasAnyActivePlan: subscriberActivePlanIds.length > 0,
      subscriberActivePlanIds,
    };
  }

  async getAdminWebhookToken(planId: number) {
    if (!Number.isFinite(planId) || planId <= 0) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "Invalid planId" };
    }

    const token = await this.db.getAdminWebhookToken(planId);
    if (!token) {
      throw { statusCode: HttpStatusCode._NOT_FOUND, message: "Plan not found" };
    }
    return token;
  }

  async rotateAdminWebhookToken(planId: number) {
    if (!Number.isFinite(planId) || planId <= 0) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "Invalid planId" };
    }

    const plan = await this.db.getPlanById(planId);
    if (!plan) {
      throw { statusCode: HttpStatusCode._NOT_FOUND, message: "Plan not found" };
    }

    return this.db.rotateAdminWebhookToken(planId);
  }

  async getPlanByAdminWebhookToken(token: string) {
    return this.db.findPlanByAdminWebhookToken(token);
  }
}
