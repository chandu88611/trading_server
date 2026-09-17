import { UserSubscriptionDBService } from "./userSubscription.db";
import {
  IUserSubscribePayload,
  IUserSubscriptionCancelPayload,
} from "../interfaces/userSubscription.interface";
import { HttpStatusCode } from "../../../types/constants";
import { MarketType } from "../../../types/trade-identify";
import { SubscriptionPlan, UserStrategyInstance, UserSubscription } from "../../../entity";
import {
  normalizePlanStrategies,
  selectPrimaryPlanStrategy,
  selectUnavailablePlanStrategyForNewSubscription,
} from "../../subscriptionPlan/utils/planStrategy";

export class UserSubscriptionService {
  private db: UserSubscriptionDBService;

  constructor() {
    this.db = new UserSubscriptionDBService();
  }

  async ensureSchema() {
    await this.db.ensureSchema();
  }

  private buildStrategyMap(instances: UserStrategyInstance[]) {
    return new Map(
      instances.map((instance) => [
        Number(instance.subscriptionId),
        {
          instanceId: Number(instance.id),
          status: instance.status,
          volume: Number(instance.volume),
          definition: {
            id: Number(instance.strategy.id),
            strategyCode: instance.strategy.strategyCode,
            name: instance.strategy.name,
            isActive: Boolean(instance.strategy.isActive),
          },
          managedByAdminWebhook: true as const,
        },
      ])
    );
  }

  private attachStrategy(subscription: UserSubscription, strategyMap: Map<number, any>) {
    const normalizedPlanStrategies = normalizePlanStrategies(
      subscription.plan?.planStrategies as any
    );
    const firstPlanStrategy = selectPrimaryPlanStrategy(normalizedPlanStrategies as any);
    return Object.assign(subscription as any, {
      strategy: firstPlanStrategy
        ? strategyMap.get(Number(subscription.id)) ?? null
        : null,
      plan: Object.assign(subscription.plan as any, {
        planStrategies: normalizedPlanStrategies.slice(0, 1),
        strategy: firstPlanStrategy?.strategy
          ? {
              id: Number(firstPlanStrategy.strategy.id),
              strategyCode: firstPlanStrategy.strategy.strategyCode,
              name: firstPlanStrategy.strategy.name,
              isActive: Boolean(firstPlanStrategy.strategy.isActive),
            }
          : null,
      }),
    });
  }

  async subscribe(userId: number, payload: IUserSubscribePayload) {
    const { planId } = payload;

    if (!Number.isSafeInteger(planId) || planId <= 0) throw { statusCode: 400, message: "valid_plan_id_required" };

    const plan: SubscriptionPlan | null = await this.db.getPlan(planId);
    if (!plan) throw new Error("Invalid or inactive subscription plan");

    // Paid subscriptions are activated only by the verified billing transaction.
    if (plan.pricing?.isFree !== true || Number(plan.pricing?.priceInr) !== 0) {
      throw { statusCode: 402, message: "payment_verification_required" };
    }
    const existing = await this.db.getActiveSubscription(userId,plan);

    const alreadySubscribedToSamePlan =
      (existing ?? []).some((sub: any) => Number(sub.planId) === Number(planId));

    if (alreadySubscribedToSamePlan) {
      throw new Error("User already has an active subscription for this plan");
    }
    if (selectUnavailablePlanStrategyForNewSubscription(plan.planStrategies as any)) {
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: "strategy_unavailable_for_new_subscription",
      };
    }
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

  async getCurrentSubscription(userId: number, start: number, count: number, searchParams?: any) {
    const subscription = await this.db.getActiveSubscriptionCurrent(userId, start, count, searchParams);
    const subscriptionIds = (subscription.data ?? []).map((item: UserSubscription) => Number(item.id));
    const instances = await this.db.getStrategyInstancesForSubscriptions(userId, subscriptionIds);
    const strategyMap = this.buildStrategyMap(instances);

    return {
      ...subscription,
      data: (subscription.data ?? []).map((item: UserSubscription) =>
        this.attachStrategy(item, strategyMap)
      ),
    };
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

  saveWebhookSettings(
    userId: number,
    payload: {
      subscriptionId?: number | null;
      planId?: number | null;
      isWebhookEnabled: boolean;
      defaultTradingAccountId?: number | null;
      payloadDefaults?: Record<string, any>;
    }
  ) {
    return this.db.saveWebhookSettings(userId, payload);
  }
}
