// src/app/subscriptionPlan/services/subscriptionPlan.db.ts
import { Repository, ILike } from "typeorm";
import AppDataSource from "../../../db/data-source";
import { SubscriptionPlan } from "../../../entity/SubscriptionPlan";
import { ICreateSubscriptionPlan, IQueryPlans, IUpdateSubscriptionPlan } from "../interfaces/subscriberPlan.interface";

export class SubscriptionPlanDBService {
  private planRepo: Repository<SubscriptionPlan>;

  constructor() {
    this.planRepo = AppDataSource.getRepository(SubscriptionPlan);
  }

  createPlan(payload: ICreateSubscriptionPlan) {
    const plan = this.planRepo.create({
      ...payload,
      currency: payload.currency ?? "INR",
      isActive: payload.isActive ?? true,
      maxActiveStrategies: payload.maxActiveStrategies ?? 1,
      maxConnectedAccounts: payload.maxConnectedAccounts ?? 1,
      maxDailyTrades: payload.maxDailyTrades ?? null,
      maxLotPerTrade: payload.maxLotPerTrade != null ? String(payload.maxLotPerTrade) : null,
      featureFlags: payload.featureFlags ?? {},
      metadata: payload.metadata ?? null,
    });
    return this.planRepo.save(plan);
  }

  getPlanById(id: number) {
    return this.planRepo.findOne({ where: { id } });
  }

  getPlanByCode(planCode: string) {
    return this.planRepo.findOne({ where: { planCode } });
  }

  updatePlan(id: number, payload: IUpdateSubscriptionPlan) {
    const update: any = { ...payload };

    // numeric -> string in PG
    if (payload.maxLotPerTrade !== undefined) {
      update.maxLotPerTrade = payload.maxLotPerTrade != null ? String(payload.maxLotPerTrade) : null;
    }

    return this.planRepo.update({ id }, update);
  }

  deletePlan(id: number) {
    return this.planRepo.delete({ id });
  }

  async getPlans(query: IQueryPlans) {
    const {
      chunkSize = 10,
      initialOffset = 0,
      searchParam,
      category,
      executionFlow,
      isActive,
    } = query;

    const where: any = {};

    if (typeof isActive === "boolean") where.isActive = isActive;
    if (category) where.category = category;
    if (executionFlow) where.executionFlow = executionFlow;

    // If searchParam exists, apply OR on name/planCode AND keep filters
    if (searchParam?.trim()) {
      return this.planRepo.findAndCount({
        where: [
          { ...where, name: ILike(`%${searchParam}%`) },
          { ...where, planCode: ILike(`%${searchParam}%`) },
        ],
        skip: initialOffset,
        take: chunkSize,
        order: { createdAt: "DESC" },
      });
    }

    return this.planRepo.findAndCount({
      where,
      skip: initialOffset,
      take: chunkSize,
      order: { createdAt: "DESC" },
    });
  }

  getActivePlans(category?: any, executionFlow?: any) {
    const where: any = { isActive: true };
    if (category) where.category = category;
    if (executionFlow) where.executionFlow = executionFlow;

    return this.planRepo.find({
      where,
      order: { priceCents: "ASC" },
    });
  }
}
