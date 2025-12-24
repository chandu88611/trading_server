import { UserSubscriptionDBService } from "./userSubscription.db";
import {
  IUserSubscribePayload,
  IUserSubscriptionCancelPayload,
} from "../interfaces/userSubscription.interface";
import { AssetType } from "../../../types/trade-identify";

export class UserSubscriptionService {
  private db: UserSubscriptionDBService;

  constructor() {
    this.db = new UserSubscriptionDBService();
  }

  async subscribe(userId: number, payload: IUserSubscribePayload) {
    const { planId } = payload;

    const plan = await this.db.getPlan(planId);
    if (!plan) throw new Error("Invalid or inactive subscription plan");

    const existing = await this.db.getActiveSubscription(userId);
    if (existing) throw new Error("User already has an active subscription");

    const durationDays = plan.interval === "monthly" ? 30 : 365;

    return this.db.createSubscription(userId, planId, durationDays);
  }

  async cancel(userId: number, payload: IUserSubscriptionCancelPayload) {
    const sub = await this.db.getActiveSubscription(userId);
    if (!sub) throw new Error("User has no active subscription");

    if (payload.cancelAtPeriodEnd) {
      return this.db.cancelSubscription(userId);
    }

    // immediate cancellation
    await this.db.cancelSubscription(userId);
  }

  getCurrentSubscription(userId: number) {
    return this.db.getActiveSubscription(userId);
  }

  getAllSubscriptions(offset = 0, limit = 20) {
    return this.db.getAllUserSubscriptions(offset, limit);
  }

  getUserSubscriptions(userId: number) {
    return this.db.getUserSubscriptions(userId);
  }

  async subscriberPlanValidation(userId:number, assetType:AssetType){
    try {
      return await this.db.subscriberPlanValidation(userId, assetType);
    } catch (error) {
      throw error;
    }
  }
}
