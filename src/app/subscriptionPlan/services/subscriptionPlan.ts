// src/app/subscriptionPlan/services/subscriptionPlan.ts
import { SubscriptionPlanDBService } from "./subscriptionPlan.db";
import { ICreateSubscriptionPlan, IQueryPlans, IUpdateSubscriptionPlan } from "../interfaces/subscriberPlan.interface";
import { HttpStatusCode } from "../../../types/constants";

export class SubscriptionPlanService {
  private dbService: SubscriptionPlanDBService;

  constructor() {
    this.dbService = new SubscriptionPlanDBService();
  }

  async createPlan(payload: ICreateSubscriptionPlan) {
    // basic validation
    if (!payload.planCode?.trim()) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "planCode is required" };
    }
    if (!payload.name?.trim()) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "name is required" };
    }
    if (payload.priceCents == null || payload.priceCents < 0) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "priceCents must be >= 0" };
    }

    const existing = await this.dbService.getPlanByCode(payload.planCode.trim());
    if (existing) {
      throw { statusCode: HttpStatusCode._CONFLICT, message: "planCode already exists" };
    }

    return this.dbService.createPlan({
      ...payload,
      planCode: payload.planCode.trim(),
      name: payload.name.trim(),
    });
  }

  async getPlan(id: number) {
    if (!Number.isFinite(id)) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "Invalid planId" };
    }

    const plan = await this.dbService.getPlanById(id);
    if (!plan) {
      throw { statusCode: HttpStatusCode._NOT_FOUND, message: "Plan not found" };
    }
    return plan;
  }

  async updatePlan(id: number, payload: IUpdateSubscriptionPlan) {
    if (!Number.isFinite(id)) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "Invalid planId" };
    }

    const plan = await this.dbService.getPlanById(id);
    if (!plan) {
      throw { statusCode: HttpStatusCode._NOT_FOUND, message: "Plan not found" };
    }

    // avoid null featureFlags accidentally
    if (payload.featureFlags === undefined) {
      // don't touch it
    } else if (payload.featureFlags === null) {
      payload.featureFlags = {};
    }

    await this.dbService.updatePlan(id, payload);
    return true;
  }

  async deletePlan(id: number) {
    if (!Number.isFinite(id)) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "Invalid planId" };
    }

    const plan = await this.dbService.getPlanById(id);
    if (!plan) {
      throw { statusCode: HttpStatusCode._NOT_FOUND, message: "Plan not found" };
    }

    // safer: soft behavior: deactivate instead of delete
    // (you can switch to hard delete if you want)
    await this.dbService.updatePlan(id, { isActive: false });
    return true;
  }

  getPlans(query: IQueryPlans) {
    return this.dbService.getPlans(query);
  }

  getActivePlans(category?: any, executionFlow?: any) {
    return this.dbService.getActivePlans(category, executionFlow);
  }
}
