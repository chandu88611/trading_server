// src/app/subscriptionPlan/services/subscriptionPlan.ts
import { HttpStatusCode } from "../../../types/constants";
import {
  ICreateSubscriptionPlan,
  IQueryPlans,
  IUpdateSubscriptionPlan,
} from "../interfaces/subscriberPlan.interface";
import { SubscriptionPlanDBService } from "./subscriptionPlan.db";

export class SubscriptionPlanService {
  private db: SubscriptionPlanDBService;

  constructor() {
    this.db = new SubscriptionPlanDBService();
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

    return this.db.createPlan({
      ...payload,
      name: payload.name.trim(),
      description: payload.description ?? null,
      metadata: payload.metadata ?? {},
      isActive: payload.isActive ?? true,
    });
  }

  async getPlan(id: string) {
    if (!id?.trim()) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "Invalid planId" };
    }
    const plan = await this.db.getPlanById(id);
    if (!plan) {
      throw { statusCode: HttpStatusCode._NOT_FOUND, message: "Plan not found" };
    }
    return plan;
  }

  async updatePlan(id: string, payload: IUpdateSubscriptionPlan) {
    if (!id?.trim()) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "Invalid planId" };
    }

    const existing = await this.db.getPlanById(id);
    if (!existing) {
      throw { statusCode: HttpStatusCode._NOT_FOUND, message: "Plan not found" };
    }

    if (payload.name !== undefined && !payload.name.trim()) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "name cannot be empty" };
    }

    await this.db.updatePlan(id, {
      ...payload,
      name: payload.name?.trim(),
      description: payload.description ?? undefined,
    });

    return true;
  }

  async deactivatePlan(id: string) {
    if (!id?.trim()) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "Invalid planId" };
    }

    const plan = await this.db.getPlanById(id);
    if (!plan) {
      throw { statusCode: HttpStatusCode._NOT_FOUND, message: "Plan not found" };
    }

    await this.db.updatePlan(id, { isActive: false });
    return true;
  }

  getPlans(query: IQueryPlans) {
    return this.db.getPlans(query);
  }
}
