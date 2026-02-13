import { Brackets, DeepPartial, Repository } from "typeorm";
import AppDataSource from "../../../db/data-source";

import { UserSubscription } from "../../../entity/UserSubscription";
import { SubscriptionPlan } from "../../../entity/SubscriptionPlan";

import { signWebhookToken } from "../../../middleware/auth";
import { SubscriptionStatus } from "../../subscriptionPlan/enums/subscriberPlan.enum";
import { AssetType, MarketType } from "../../../types/trade-identify";

type HttpErr = { statusCode: number; message: string };
const badRequest = (message: string): HttpErr => ({ statusCode: 400, message });

export class UserSubscriptionDBService {
  private subRepo: Repository<UserSubscription>;
  private planRepo: Repository<SubscriptionPlan>;

  constructor() {
    this.subRepo = AppDataSource.getRepository(UserSubscription);
    this.planRepo = AppDataSource.getRepository(SubscriptionPlan);
  }

  async getActiveSubscription(userId: number) {
    let data =  await this.subRepo.find({
      where: {
        userId: userId as any,
        statusV2: SubscriptionStatus.ACTIVE as any,
      } as any,
      relations: {
        plan: true,
      } as any
    });
    console.log("getActiveSubscription", { userId, data });
    return data

  }

    async getActiveSubscriptionCurrent(userId: number,start: number, count: number,  searchParams?: any) {
      // with market
      try {
        let data =  this.subRepo.createQueryBuilder("us")
        .leftJoinAndSelect("us.plan", "plan")
        .leftJoinAndSelect("plan.market", "market")
        .where("us.user_id = :userId", { userId })
        .andWhere("us.status_v2 = :status", { status: SubscriptionStatus.ACTIVE })
        .andWhere("plan.is_active = true")
        // Optional: filter by market if searchParams.market is provided
        if(searchParams){
          if(searchParams.market){
            data = data.andWhere("market.code = :marketCode", { marketCode: searchParams.market });
          }
        }
        let itemData = await data.skip(start).take(count).getMany();
        console.log("getActiveSubscriptionCurrent", { userId, itemData });
        return itemData
      } catch (error) {
        throw error
      }
    // return this.subRepo.find({
    //   where: {
    //     userId: userId as any,
    //     statusV2: SubscriptionStatus.ACTIVE as any,

    //   } as any,
    //   relations: {
    //     plan: true,
    //   } as any,
    //   order: { createdAt: "DESC" } as any,
    //   skip: start,
    //   take: count,
    // });
  }

  /**
   * New design:
   * - planId is BIGINT (number)
   * - need pricing relation (interval is there)
   * - ensure isActive = true
   */
  getPlan(planId: number) {
    return this.planRepo.findOne({
      where: { id: planId, isActive: true } as any,
      relations: {
        pricing: true,
        planType: true,
        market: true,
      } as any,
    });
  }

  async createSubscription(userId: number, planId: number, durationDays: number) {
    const now = new Date();
    const end = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    const data: DeepPartial<UserSubscription> = {
      userId: userId as any,
      planId: planId as any, // BIGINT (number)
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
  async subscriberPlanValidation(userId: number, marketType: MarketType) {
    const qb = this.subRepo
      .createQueryBuilder("us")
      .innerJoinAndSelect("us.plan", "plan")
      .leftJoinAndSelect("plan.market", "market")
      .where("us.user_id = :userId", { userId })
      .andWhere("us.status_v2 = :status", { status: SubscriptionStatus.ACTIVE })
      .andWhere("plan.is_active = true")
      .andWhere(
        new Brackets((q) => {
          q.where("plan.market_id IS NULL")        
           .orWhere("market.code = :mc", { mc: marketType }); 
        })
      );
    const data = await qb.getOne();
    return data || null;
  }
}
