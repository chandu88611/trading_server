"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSubscriptionDBService = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = __importDefault(require("../../../db/data-source"));
const UserSubscription_1 = require("../../../entity/UserSubscription");
const SubscriptionPlan_1 = require("../../../entity/SubscriptionPlan");
const auth_1 = require("../../../middleware/auth");
const subscriberPlan_enum_1 = require("../../subscriptionPlan/enums/subscriberPlan.enum");
const CopyTradingFollow_1 = require("../../../entity/CopyTradingFollow");
class UserSubscriptionDBService {
    constructor() {
        this.subRepo = data_source_1.default.getRepository(UserSubscription_1.UserSubscription);
        this.planRepo = data_source_1.default.getRepository(SubscriptionPlan_1.SubscriptionPlan);
        this.copyTradingFollowersRepo = data_source_1.default.getRepository(CopyTradingFollow_1.CopyTradingFollowers);
    }
    async getActiveSubscription(userId, plan) {
        let query = this.subRepo.createQueryBuilder("us")
            .leftJoinAndSelect("us.plan", "plan")
            .where("us.user_id = :userId", { userId })
            .andWhere("us.status_v2 = :status", { status: subscriberPlan_enum_1.SubscriptionStatus.ACTIVE })
            .andWhere("plan.is_active = true");
        if (plan) {
            query.andWhere("plan.id = :planId", { planId: plan.id });
        }
        const data = await query.getMany();
        console.log("getActiveSubscription", { userId, data });
        return data;
    }
    async getActiveSubscriptionCurrent(userId, start, count, searchParams) {
        // with market
        try {
            /*
              @OneToOne(() => PlanPricing, (p) => p.plan)
              pricing?: PlanPricing;
            
              @OneToOne(() => PlanLimits, (l) => l.plan)
              limits?: PlanLimits;
            
              @OneToMany(() => PlanFeature, (f) => f.plan)
              features?: PlanFeature[];
            
              @OneToMany(() => PlanBundleItem, (bi) => bi.bundlePlan)
              bundleItems?: PlanBundleItem[];
            
              @OneToMany(() => PlanBundleItem, (bi) => bi.includedPlan)
              includedInBundles?: PlanBundleItem[];
            
              @OneToMany(() => PlanStrategy, (ps) => ps.plan)
              planStrategies?: PlanStrategy[];
            
              // existing relations
              @OneToMany(() => UserSubscription, (sub) => sub.plan)
              userSubscriptions?: UserSubscription[];
            
              @OneToMany(() => SubscriptionInvoice, (inv) => inv.plan)
              invoices?: SubscriptionInvoice[];
            */
            let data = this.subRepo.createQueryBuilder("us")
                .leftJoinAndSelect("us.plan", "plan")
                .leftJoinAndSelect("plan.pricing", "pricing")
                .leftJoinAndSelect("plan.market", "market")
                .leftJoinAndSelect("plan.planType", "planType")
                .leftJoinAndSelect("plan.features", "features")
                .leftJoinAndSelect("plan.limits", "limits")
                .leftJoinAndSelect("plan.planStrategies", "planStrategies")
                .leftJoinAndSelect("plan.includedInBundles", "includedInBundles")
                .leftJoinAndSelect("includedInBundles.bundlePlan", "bundlePlan")
                .leftJoinAndSelect("bundlePlan.pricing", "bundlePlanPricing")
                .leftJoinAndSelect("bundlePlan.market", "bundlePlanMarket")
                .leftJoinAndSelect("bundlePlan.planType", "bundlePlanType")
                .where("us.user_id = :userId", { userId })
                .andWhere("us.status_v2 = :status", { status: subscriberPlan_enum_1.SubscriptionStatus.ACTIVE })
                .andWhere("plan.is_active = true");
            if (searchParams) {
                if (searchParams.market) {
                    data = data.andWhere("market.code = :marketCode", { marketCode: searchParams.market });
                }
            }
            let itemData = await data.skip(start).take(count).getMany();
            let followerFormat = await this.copyTradingFollowersRepo.find({
                where: {
                    followerUserId: userId,
                },
                relations: ["master", "master.user"],
            });
            console.log("getActiveSubscriptionCurrent", { userId, itemData });
            return { data: itemData, followers: followerFormat };
        }
        catch (error) {
            throw error;
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
    async getFollowerUserTradingAccount(userId, start, count, searchParams) {
        try {
            console.log("getFollowerUserTradingAccount", { userId, start, count, searchParams });
            let query = this.copyTradingFollowersRepo
                .createQueryBuilder("followers")
                .leftJoinAndSelect("followers.master", "master")
                .leftJoinAndSelect("master.user", "masterUser")
                .leftJoinAndSelect("master.broker", "masterBroker")
                .leftJoinAndSelect("master.subscription", "masterSubscription")
                .leftJoinAndSelect("masterSubscription.plan", "masterSubscriptionPlan")
                .leftJoinAndSelect("followers.followerTradingAccount", "followerTradingAccount")
                .leftJoinAndSelect("followerTradingAccount.broker", "followerTradingAccountBroker")
                .leftJoinAndSelect("followerTradingAccount.subscription", "followerTradingAccountSubscription")
                .leftJoinAndSelect("followerTradingAccountSubscription.plan", "followerTradingAccountSubscriptionPlan")
                .where("followers.followerUserId = :userId", { userId });
            if (searchParams && typeof searchParams === "object" && "status" in searchParams) {
                query = query.andWhere("followers.status = :status", {
                    status: searchParams.status,
                });
            }
            const followers = await query
                .orderBy("followers.createdAt", "DESC")
                .skip(start)
                .take(count)
                .getMany();
            return followers;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * New design:
     * - planId is BIGINT (number)
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
            planId: planId, // BIGINT (number)
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
    async subscriberPlanValidation(userId, marketType) {
        const qb = this.subRepo
            .createQueryBuilder("us")
            .innerJoinAndSelect("us.plan", "plan")
            .leftJoinAndSelect("plan.market", "market")
            .where("us.user_id = :userId", { userId })
            .andWhere("us.status_v2 = :status", { status: subscriberPlan_enum_1.SubscriptionStatus.ACTIVE })
            .andWhere("plan.is_active = true")
            .andWhere(new typeorm_1.Brackets((q) => {
            q.where("plan.market_id IS NULL")
                .orWhere("market.code = :mc", { mc: marketType });
        }));
        const data = await qb.getOne();
        return data || null;
    }
    async updateSubscriptionWebhookStatus(subscriptionId, isEnabled) {
        try {
            await this.subRepo.update({ id: subscriptionId }, {
                isWebhookEnabled: isEnabled,
            });
        }
        catch (error) {
            throw error;
        }
    }
}
exports.UserSubscriptionDBService = UserSubscriptionDBService;
