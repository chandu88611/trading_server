"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSubscriptionService = void 0;
const userSubscription_db_1 = require("./userSubscription.db");
const constants_1 = require("../../../types/constants");
const planStrategy_1 = require("../../subscriptionPlan/utils/planStrategy");
class UserSubscriptionService {
    constructor() {
        this.db = new userSubscription_db_1.UserSubscriptionDBService();
    }
    async ensureSchema() {
        await this.db.ensureSchema();
    }
    buildStrategyMap(instances) {
        return new Map(instances.map((instance) => [
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
                managedByAdminWebhook: true,
            },
        ]));
    }
    attachStrategy(subscription, strategyMap) {
        const normalizedPlanStrategies = (0, planStrategy_1.normalizePlanStrategies)(subscription.plan?.planStrategies);
        const firstPlanStrategy = (0, planStrategy_1.selectPrimaryPlanStrategy)(normalizedPlanStrategies);
        return Object.assign(subscription, {
            strategy: firstPlanStrategy
                ? strategyMap.get(Number(subscription.id)) ?? null
                : null,
            plan: Object.assign(subscription.plan, {
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
    async subscribe(userId, payload) {
        const { planId } = payload;
        if (!planId)
            throw new Error("planId is required");
        const plan = await this.db.getPlan(planId);
        if (!plan)
            throw new Error("Invalid or inactive subscription plan");
        const existing = await this.db.getActiveSubscription(userId, plan);
        const alreadySubscribedToSamePlan = (existing ?? []).some((sub) => Number(sub.planId) === Number(planId));
        if (alreadySubscribedToSamePlan) {
            throw new Error("User already has an active subscription for this plan");
        }
        if ((0, planStrategy_1.selectUnavailablePlanStrategyForNewSubscription)(plan.planStrategies)) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "strategy_unavailable_for_new_subscription",
            };
        }
        // NEW DESIGN: interval comes from pricing.interval
        const interval = plan.pricing?.interval ?? "monthly";
        const durationDays = interval === "monthly" ? 30 : interval === "yearly" ? 365 : 36500; // lifetime ~ 100y
        return this.db.createSubscription(userId, planId, durationDays);
    }
    async cancel(userId, payload) {
        const sub = await this.db.getActiveSubscription(userId);
        if (!sub)
            throw new Error("User has no active subscription");
        if (payload.cancelAtPeriodEnd) {
            // If you want true period-end behavior:
            // return this.db.cancelAtPeriodEnd(userId);
            // If you want to keep old behavior (immediate):
            return this.db.cancelSubscriptionNow(userId);
        }
        await this.db.cancelSubscriptionNow(userId);
    }
    async getCurrentSubscription(userId, start, count, searchParams) {
        const subscription = await this.db.getActiveSubscriptionCurrent(userId, start, count, searchParams);
        const subscriptionIds = (subscription.data ?? []).map((item) => Number(item.id));
        const instances = await this.db.getStrategyInstancesForSubscriptions(userId, subscriptionIds);
        const strategyMap = this.buildStrategyMap(instances);
        return {
            ...subscription,
            data: (subscription.data ?? []).map((item) => this.attachStrategy(item, strategyMap)),
        };
    }
    getFollowerUserTradingAccount(userId, start, count, searchParams) {
        return this.db.getFollowerUserTradingAccount(userId, start, count, searchParams);
    }
    getAllSubscriptions(offset = 0, limit = 20) {
        return this.db.getAllUserSubscriptions(offset, limit);
    }
    getUserSubscriptions(userId) {
        return this.db.getUserSubscriptions(userId);
    }
    async subscriberPlanValidation(userId, marketType) {
        return this.db.subscriberPlanValidation(userId, marketType);
    }
    async updateSubscriptionWebhookStatus(subscriptionId, isEnabled) {
        try {
            await this.db.updateSubscriptionWebhookStatus(subscriptionId, isEnabled);
        }
        catch (error) {
            throw error;
        }
    }
    saveWebhookSettings(userId, payload) {
        return this.db.saveWebhookSettings(userId, payload);
    }
}
exports.UserSubscriptionService = UserSubscriptionService;
