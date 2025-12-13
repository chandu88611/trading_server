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
        const plan = await this.db.getPlan(planId);
        if (!plan)
            throw new Error("Invalid or inactive subscription plan");
        const existing = await this.db.getActiveSubscription(userId);
        if (existing)
            throw new Error("User already has an active subscription");
        const durationDays = plan.interval === "monthly" ? 30 : 365;
        return this.db.createSubscription(userId, planId, durationDays);
    }
    async cancel(userId, payload) {
        const sub = await this.db.getActiveSubscription(userId);
        if (!sub)
            throw new Error("User has no active subscription");
        if (payload.cancelAtPeriodEnd) {
            return this.db.cancelSubscription(userId);
        }
        // immediate cancellation
        await this.db.cancelSubscription(userId);
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
}
exports.UserSubscriptionService = UserSubscriptionService;
