import { UserSubscriptionDBService } from "./userSubscription.db";
import {
  IUserSubscribePayload,
  IUserSubscriptionCancelPayload,
} from "../interfaces/userSubscription.interface";
import { MarketType } from "../../../types/trade-identify";
import { SubscriptionPlan } from "../../../entity";

export class UserSubscriptionService {
  private db: UserSubscriptionDBService;

  constructor() {
    this.db = new UserSubscriptionDBService();
  }

  async subscribe(userId: number, payload: IUserSubscribePayload) {
    const { planId } = payload;

    if (!planId) throw new Error("planId is required");

    const plan: SubscriptionPlan | null = await this.db.getPlan(planId);
    if (!plan) throw new Error("Invalid or inactive subscription plan");

    const existing = await this.db.getActiveSubscription(userId,plan);

    if (existing?.length !== 0) throw new Error("User already has an active subscription");
    // NEW DESIGN: interval comes from pricing.interval
    const interval = (plan as any).pricing?.interval ?? "monthly";

    const durationDays = interval === "monthly" ? 30 : interval === "yearly" ? 365 : 36500; // lifetime ~ 100y
    return this.db.createSubscription(userId, planId, durationDays);
  }

  async cancel(userId: number, payload: IUserSubscriptionCancelPayload) {
    const sub = await this.db.getActiveSubscription(userId);
    if (!sub) throw new Error("User has no active subscription");

    if (payload.cancelAtPeriodEnd) {
      // If you want true period-end behavior:
      // return this.db.cancelAtPeriodEnd(userId);
      // If you want to keep old behavior (immediate):
      return this.db.cancelSubscriptionNow(userId);
    }

    await this.db.cancelSubscriptionNow(userId);
  }

  getCurrentSubscription(userId: number, start: number, count: number, searchParams?: any) {
    return this.db.getActiveSubscriptionCurrent(userId, start, count, searchParams);
  }

  getFollowerUserTradingAccount(userId: number, start: number, count: number, searchParams?: any) {
    return this.db.getFollowerUserTradingAccount(userId, start, count, searchParams);
  }

  getAllSubscriptions(offset = 0, limit = 20) {
    return this.db.getAllUserSubscriptions(offset, limit);
  }

  getUserSubscriptions(userId: number) {
    return this.db.getUserSubscriptions(userId);
  }

  async subscriberPlanValidation(userId: number, marketType: MarketType) {
    return this.db.subscriberPlanValidation(userId, marketType);
  }

  async updateSubscriptionWebhookStatus(subscriptionId: number, isEnabled: boolean) {
    try {
      await this.db.updateSubscriptionWebhookStatus(subscriptionId, isEnabled);
    } catch (error) {
      throw error
    }
  }
}
