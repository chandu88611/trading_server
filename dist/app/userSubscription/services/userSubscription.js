"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSubscriptionService = void 0;
const userSubscription_db_1 = require("./userSubscription.db");
class UserSubscriptionService {
    constructor() {
        this.db = new userSubscription_db_1.UserSubscriptionDBService();
    }
    async subscribe(userId, payload) {
        const { planId } = payload;
        if (!planId?.trim())
            throw new Error("planId is required");
        const plan = await this.db.getPlan(planId);
        if (!plan)
            throw new Error("Invalid or inactive subscription plan");
        const existing = await this.db.getActiveSubscription(userId);
        if (existing)
            throw new Error("User already has an active subscription");
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
    getCurrentSubscription(userId) {
        return this.db.getActiveSubscription(userId);
    }
    getAllSubscriptions(offset = 0, limit = 20) {
        return this.db.getAllUserSubscriptions(offset, limit);
    }
    getUserSubscriptions(userId) {
        return this.db.getUserSubscriptions(userId);
    }
    async subscriberPlanValidation(userId, assetType) {
        return this.db.subscriberPlanValidation(userId, assetType);
    }
}
exports.UserSubscriptionService = UserSubscriptionService;
