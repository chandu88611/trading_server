import { DeepPartial, Repository } from "typeorm";
import AppDataSource from "../../../db/data-source";

import { UserSubscription } from "../../../entity/UserSubscription";
import { SubscriptionPlan } from "../../../entity/SubscriptionPlan";

import { signWebhookToken } from "../../../middleware/auth";
import { SubscriptionStatus } from "../../subscriptionPlan/enums/subscriberPlan.enum";
import { AssetType } from "../../../types/trade-identify";

type HttpErr = { statusCode: number; message: string };
const badRequest = (message: string): HttpErr => ({ statusCode: 400, message });

export class UserSubscriptionDBService {
  private subRepo: Repository<UserSubscription>;
  private planRepo: Repository<SubscriptionPlan>;

  constructor() {
    this.subRepo = AppDataSource.getRepository(UserSubscription);
    this.planRepo = AppDataSource.getRepository(SubscriptionPlan);
  }

  getActiveSubscription(userId: number) {
    return this.subRepo.findOne({
      where: {
        userId: userId as any,
        statusV2: SubscriptionStatus.ACTIVE as any,
      } as any,
      relations: {
        plan: true,
      } as any,
    });
  }

  /**
   * New design:
   * - planId is UUID string
   * - need pricing relation (interval is there)
   * - ensure isActive = true
   */
  getPlan(planId: string) {
    return this.planRepo.findOne({
      where: { id: planId, isActive: true } as any,
      relations: {
        pricing: true,
        planType: true,
        market: true,
      } as any,
    });
  }

  async createSubscription(userId: number, planId: string, durationDays: number) {
    const now = new Date();
    const end = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    const data: DeepPartial<UserSubscription> = {
      userId: userId as any,
      planId: planId as any, // UUID
      startDate: now,
      endDate: end,

      // NEW enum column
      statusV2: SubscriptionStatus.ACTIVE as any,

      // legacy column (text) - keep in sync
      status: "active",

      executionEnabled: true,
      webhookToken: null,
      metadata: null,
    } as any;

    const sub = this.subRepo.create(data);
    const saved = await this.subRepo.save(sub);

    const webhookToken = signWebhookToken(
      {
        userId,
        subscriptionId: saved.id,
        planId,
      },
      saved.endDate as Date
    );

    saved.webhookToken = webhookToken;
    return this.subRepo.save(saved);
  }

  /**
   * If cancelAtPeriodEnd=true => you might want to set cancel_at instead of ending now.
   * But your current behavior ends subscription now, so keeping same behavior.
   */
  async cancelSubscriptionNow(userId: number) {
    return this.subRepo.update(
      { userId: userId as any, statusV2: SubscriptionStatus.ACTIVE as any } as any,
      {
        statusV2: SubscriptionStatus.CANCELED as any,
        status: "canceled",
        canceledAt: new Date(),
        endDate: new Date(),
      } as any
    );
  }

  /**
   * Optional: period-end cancellation
   * - marks cancelAt, keeps endDate as-is
   * - does NOT stop immediately
   */
  async cancelAtPeriodEnd(userId: number) {
    return this.subRepo.update(
      { userId: userId as any, statusV2: SubscriptionStatus.ACTIVE as any } as any,
      {
        cancelAt: new Date(), // "request time" (you can change semantics)
      } as any
    );
  }

  getAllUserSubscriptions(offset = 0, limit = 20) {
    return this.subRepo.findAndCount({
      skip: offset,
      take: limit,
      relations: {
        plan: true,
      } as any,
      order: { createdAt: "DESC" } as any,
    });
  }

  getUserSubscriptions(userId: number) {
    return this.subRepo.find({
      where: { userId: userId as any } as any,
      relations: {
        plan: true,
      } as any,
      order: { createdAt: "DESC" } as any,
    });
  }

  /**
   * New design:
   * old code: plan.category = assetType
   * new code: use plan.market.code (FOREX/CRYPTO/INDIAN) to validate
   */
  async subscriberPlanValidation(userId: number, assetType: AssetType) {
    const qb = this.subRepo
      .createQueryBuilder("us")
      .innerJoinAndSelect("us.plan", "plan")
      .leftJoinAndSelect("plan.market", "market")
      .where("us.user_id = :userId", { userId })
      .andWhere("us.status_v2 = :status", { status: SubscriptionStatus.ACTIVE })
      .andWhere("plan.is_active = true");

    // Map AssetType -> market.code if needed
    // If your AssetType already matches: 'FOREX' | 'CRYPTO' | 'INDIAN', this works directly.
    qb.andWhere("market.code = :mc", { mc: assetType });

    return qb.getOne();
  }
}
