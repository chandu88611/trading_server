import { DeepPartial, Repository } from "typeorm";
import { UserSubscription, SubscriptionPlan } from "../../../entity";
import AppDataSource from "../../../db/data-source";
import { UserSubscriptionStatus } from "../enums/userSubscription.enum";
import { AssetType } from "../../../types/trade-identify";
import { signWebhookToken } from "../../../middleware/auth";
import { SubscriptionStatus } from "../../subscriptionPlan/enums/subscriberPlan.enum";

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
        status: SubscriptionStatus.ACTIVE,
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
    const data: DeepPartial<UserSubscription> = {
    userId,
    planId,
    startDate: new Date(),
      endDate: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
    status: SubscriptionStatus.ACTIVE
  };

  const subscription: UserSubscription = this.subRepo.create(data);
const saved: UserSubscription = await this.subRepo.save(subscription);

  const webhookToken = signWebhookToken({
    userId,
    subscriptionId: saved.id,
    planId,
  },saved.endDate as Date);

  saved.webhookToken = webhookToken;
  return this.subRepo.save(saved);
  }


  async cancelSubscription(userId: number) {
    return this.subRepo.update(
      { userId, status: SubscriptionStatus.ACTIVE },
      {
        status: SubscriptionStatus.CANCELED,
        endDate: new Date(),
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
