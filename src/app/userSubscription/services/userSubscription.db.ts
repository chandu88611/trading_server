import { Repository } from "typeorm";
import { UserSubscription, SubscriptionPlan } from "../../../entity";
import AppDataSource from "../../../db/data-source";
import { UserSubscriptionStatus } from "../enums/userSubscription.enum";
import { AssetType } from "../../../types/trade-identify";

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
        userId,
        status: UserSubscriptionStatus.ACTIVE,
      },
      relations: ["plan"],
    });
  }

  getPlan(planId: number) {
    return this.planRepo.findOne({ where: { id: planId, isActive: true } });
  }

  async createSubscription(
    userId: number,
    planId: number,
    durationDays: number
  ) {
    const subscription = this.subRepo.create({
      userId,
      planId,
      startDate: new Date(),
      endDate: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
      status: UserSubscriptionStatus.ACTIVE,
    });

    return this.subRepo.save(subscription);
  }

  async cancelSubscription(userId: number) {
    return this.subRepo.update(
      { userId, status: UserSubscriptionStatus.ACTIVE },
      {
        status: UserSubscriptionStatus.CANCELED,
        cancelAt: new Date(),
      }
    );
  }

  getAllUserSubscriptions(offset = 0, limit = 20) {
    return this.subRepo.findAndCount({
      skip: offset,
      take: limit,
      relations: ["plan"],
      order: { createdAt: "DESC" },
    });
  }

  getUserSubscriptions(userId: number) {
    return this.subRepo.find({
      where: { userId },
      relations: ["plan"],
      order: { createdAt: "DESC" },
    });
  }

  async subscriberPlanValidation(userId: number, assetType: AssetType) {
    try {
      let plan = await this.subRepo
        .createQueryBuilder("user_subscription")
        .innerJoinAndSelect("user_subscription.plan", "plan")
        .where("user_subscription.user_id = :userId", { userId })
        .andWhere("user_subscription.status = :status", {
          status: UserSubscriptionStatus.ACTIVE,
        })
        .andWhere("plan.category = :assetType", { assetType })
        .getOne();

      return plan;
    } catch (error) {
      throw error;
    }
  }
}
