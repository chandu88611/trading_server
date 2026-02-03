"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSubscriptionDBService = void 0;
const data_source_1 = __importDefault(require("../../../db/data-source"));
const UserSubscription_1 = require("../../../entity/UserSubscription");
const SubscriptionPlan_1 = require("../../../entity/SubscriptionPlan");
const auth_1 = require("../../../middleware/auth");
const subscriberPlan_enum_1 = require("../../subscriptionPlan/enums/subscriberPlan.enum");
const badRequest = (message) => ({ statusCode: 400, message });
class UserSubscriptionDBService {
    constructor() {
        this.subRepo = data_source_1.default.getRepository(UserSubscription_1.UserSubscription);
        this.planRepo = data_source_1.default.getRepository(SubscriptionPlan_1.SubscriptionPlan);
    }
    getActiveSubscription(userId) {
        return this.subRepo.findOne({
            where: {
                userId: userId,
                statusV2: subscriberPlan_enum_1.SubscriptionStatus.ACTIVE,
            },
            relations: {
                plan: true,
            },
        });
    }
    /**
     * New design:
     * - planId is UUID string
     * - need pricing relation (interval is there)
     * - ensure isActive = true
     */
    getPlan(planId) {
        return this.planRepo.findOne({
            where: { id: planId, isActive: true },
            relations: {
                pricing: true,
                planType: true,
                market: true,
            },
        });
    }
    async createSubscription(userId, planId, durationDays) {
        const now = new Date();
        const end = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
        const data = {
            userId: userId,
            planId: planId, // UUID
            startDate: now,
            endDate: end,
            // NEW enum column
            statusV2: subscriberPlan_enum_1.SubscriptionStatus.ACTIVE,
            // legacy column (text) - keep in sync
            status: "active",
            executionEnabled: true,
            webhookToken: null,
            metadata: null,
        };
        const sub = this.subRepo.create(data);
        const saved = await this.subRepo.save(sub);
        const webhookToken = (0, auth_1.signWebhookToken)({
            userId,
            subscriptionId: saved.id,
            planId,
        }, saved.endDate);
        saved.webhookToken = webhookToken;
        return this.subRepo.save(saved);
    }
    /**
     * If cancelAtPeriodEnd=true => you might want to set cancel_at instead of ending now.
     * But your current behavior ends subscription now, so keeping same behavior.
     */
    async cancelSubscriptionNow(userId) {
        return this.subRepo.update({ userId: userId, statusV2: subscriberPlan_enum_1.SubscriptionStatus.ACTIVE }, {
            statusV2: subscriberPlan_enum_1.SubscriptionStatus.CANCELED,
            status: "canceled",
            canceledAt: new Date(),
            endDate: new Date(),
        });
    }
    /**
     * Optional: period-end cancellation
     * - marks cancelAt, keeps endDate as-is
     * - does NOT stop immediately
     */
    async cancelAtPeriodEnd(userId) {
        return this.subRepo.update({ userId: userId, statusV2: subscriberPlan_enum_1.SubscriptionStatus.ACTIVE }, {
            cancelAt: new Date(), // "request time" (you can change semantics)
        });
    }
    getAllUserSubscriptions(offset = 0, limit = 20) {
        return this.subRepo.findAndCount({
            skip: offset,
            take: limit,
            relations: {
                plan: true,
            },
            order: { createdAt: "DESC" },
        });
    }
    getUserSubscriptions(userId) {
        return this.subRepo.find({
            where: { userId: userId },
            relations: {
                plan: true,
            },
            order: { createdAt: "DESC" },
        });
    }
    /**
     * New design:
     * old code: plan.category = assetType
     * new code: use plan.market.code (FOREX/CRYPTO/INDIAN) to validate
     */
    async subscriberPlanValidation(userId, assetType) {
        const qb = this.subRepo
            .createQueryBuilder("us")
            .innerJoinAndSelect("us.plan", "plan")
            .leftJoinAndSelect("plan.market", "market")
            .where("us.user_id = :userId", { userId })
            .andWhere("us.status_v2 = :status", { status: subscriberPlan_enum_1.SubscriptionStatus.ACTIVE })
            .andWhere("plan.is_active = true");
        // Map AssetType -> market.code if needed
        // If your AssetType already matches: 'FOREX' | 'CRYPTO' | 'INDIAN', this works directly.
        qb.andWhere("market.code = :mc", { mc: assetType });
        return qb.getOne();
    }
}
exports.UserSubscriptionDBService = UserSubscriptionDBService;
