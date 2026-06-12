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
const PlanStrategy_1 = require("../../../entity/PlanStrategy");
const UserStrategyInstance_1 = require("../../../entity/UserStrategyInstance");
const DEFAULT_STRATEGY_VOLUME = "0.01";
class UserSubscriptionDBService {
    constructor() {
        this.subRepo = data_source_1.default.getRepository(UserSubscription_1.UserSubscription);
        this.planRepo = data_source_1.default.getRepository(SubscriptionPlan_1.SubscriptionPlan);
        this.copyTradingFollowersRepo = data_source_1.default.getRepository(CopyTradingFollow_1.CopyTradingFollowers);
        this.userStrategyInstanceRepo = data_source_1.default.getRepository(UserStrategyInstance_1.UserStrategyInstance);
    }
    getManager(manager) {
        return manager ?? this.subRepo.manager;
    }
    async ensureSchema() {
        await data_source_1.default.query(`
      ALTER TABLE user_subscriptions
      ADD COLUMN IF NOT EXISTS status TEXT;
    `);
        await data_source_1.default.query(`
      UPDATE user_subscriptions
      SET status_v2 = status::subscription_status
      WHERE status_v2 IS NULL
        AND status IN (
          'trialing',
          'active',
          'past_due',
          'liquidate_only',
          'paused',
          'canceled',
          'expired'
        );
    `);
        await data_source_1.default.query(`
      UPDATE user_subscriptions
      SET status = status_v2::text
      WHERE status_v2 IS NOT NULL
        AND COALESCE(status, '') <> status_v2::text;
    `);
        await data_source_1.default.query(`
      DROP INDEX IF EXISTS uq_user_subscriptions_id_user;
    `);
        await data_source_1.default.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_user_subscriptions_id_user
      ON user_subscriptions(user_id, plan_id)
      WHERE status_v2 = 'active'::subscription_status;
    `);
        await data_source_1.default.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_user_subscriptions_webhook_token
      ON user_subscriptions(webhook_token)
      WHERE webhook_token IS NOT NULL;
    `);
    }
    async ensureWebhookToken(subscription, manager) {
        if (subscription.webhookToken) {
            return subscription;
        }
        const token = (0, auth_1.signWebhookToken)({
            userId: Number(subscription.userId),
            subscriptionId: Number(subscription.id),
            planId: Number(subscription.planId),
        }, subscription.endDate ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
        subscription.webhookToken = token;
        return this.getManager(manager).getRepository(UserSubscription_1.UserSubscription).save(subscription);
    }
    async getPlanStrategy(planId, manager) {
        return this.getManager(manager)
            .getRepository(PlanStrategy_1.PlanStrategy)
            .createQueryBuilder("planStrategy")
            .leftJoinAndSelect("planStrategy.strategy", "strategy")
            .where("planStrategy.plan_id = :planId", { planId })
            .orderBy("planStrategy.created_at", "ASC")
            .addOrderBy("planStrategy.id", "ASC")
            .getOne();
    }
    async upsertStrategyInstanceForSubscription(subscription, manager) {
        const entityManager = this.getManager(manager);
        const planStrategy = await this.getPlanStrategy(Number(subscription.planId), entityManager);
        if (!planStrategy || !planStrategy.strategy) {
            return null;
        }
        const repo = entityManager.getRepository(UserStrategyInstance_1.UserStrategyInstance);
        const existing = await repo.findOne({
            where: {
                subscriptionId: Number(subscription.id),
                strategyId: Number(planStrategy.strategyId),
            },
        });
        const next = repo.create({
            ...(existing ?? {}),
            userId: Number(subscription.userId),
            subscriptionId: Number(subscription.id),
            planId: Number(subscription.planId),
            strategyId: Number(planStrategy.strategyId),
            tradingAccountId: null,
            strategyVersion: Number(planStrategy.strategy.version ?? 1),
            frozenParams: planStrategy.strategy.defaultParams ?? {},
            status: subscriberPlan_enum_1.UserStrategyStatus.ACTIVE,
            pausedAt: null,
            stoppedAt: null,
            volume: existing?.volume ?? DEFAULT_STRATEGY_VOLUME,
            activatedAt: existing?.activatedAt ?? new Date(),
        });
        return repo.save(next);
    }
    async stopStrategyInstancesForSubscription(subscriptionId, manager) {
        await this.getManager(manager)
            .createQueryBuilder()
            .update(UserStrategyInstance_1.UserStrategyInstance)
            .set({
            status: subscriberPlan_enum_1.UserStrategyStatus.STOPPED,
            stoppedAt: new Date(),
            updatedAt: new Date(),
        })
            .where("subscription_id = :subscriptionId", { subscriptionId })
            .andWhere("status != :status", { status: subscriberPlan_enum_1.UserStrategyStatus.STOPPED })
            .execute();
    }
    async getStrategyInstancesForSubscriptions(userId, subscriptionIds) {
        if (!subscriptionIds.length) {
            return [];
        }
        return this.userStrategyInstanceRepo.find({
            where: {
                userId,
                subscriptionId: (0, typeorm_1.In)(subscriptionIds),
            },
            relations: {
                strategy: true,
            },
        });
    }
    async getStrategyInstancesBySubscriptionIds(subscriptionIds) {
        if (!subscriptionIds.length) {
            return [];
        }
        return this.userStrategyInstanceRepo.find({
            where: {
                subscriptionId: (0, typeorm_1.In)(subscriptionIds),
            },
            relations: {
                strategy: true,
            },
        });
    }
    async getActiveStrategySubscriptionsForPlan(planId) {
        return this.subRepo
            .createQueryBuilder("subscription")
            .leftJoinAndSelect("subscription.user", "user")
            .leftJoinAndSelect("subscription.plan", "plan")
            .leftJoinAndSelect("plan.market", "market")
            .leftJoinAndSelect("plan.planStrategies", "planStrategies")
            .leftJoinAndSelect("planStrategies.strategy", "strategy")
            .where("subscription.plan_id = :planId", { planId })
            .andWhere("subscription.status_v2 = :status", {
            status: subscriberPlan_enum_1.SubscriptionStatus.ACTIVE,
        })
            .andWhere("COALESCE(user.is_admin, false) = false")
            .orderBy("subscription.created_at", "DESC")
            .getMany();
    }
    async getActiveSubscription(userId, plan) {
        let query = this.subRepo.createQueryBuilder("us")
            .leftJoinAndSelect("us.plan", "plan")
            .leftJoinAndSelect("plan.planStrategies", "planStrategies")
            .leftJoinAndSelect("planStrategies.strategy", "strategy")
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
    async getActiveSubscriptionById(userId, subscriptionId) {
        return this.subRepo.findOne({
            where: {
                id: subscriptionId,
                userId: userId,
                statusV2: subscriberPlan_enum_1.SubscriptionStatus.ACTIVE,
            },
            relations: {
                plan: {
                    market: true,
                    planStrategies: {
                        strategy: true,
                    },
                },
            },
        });
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
                .leftJoinAndSelect("planStrategies.strategy", "strategy")
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
                planStrategies: {
                    strategy: true,
                },
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
        try {
            const sub = this.subRepo.create(data);
            const saved = await this.subRepo.save(sub);
            const withToken = await this.ensureWebhookToken(saved);
            await this.upsertStrategyInstanceForSubscription(withToken);
            return withToken;
        }
        catch (error) {
            if (error?.code === "23505" && error?.constraint === "uq_user_subscriptions_id_user") {
                throw {
                    statusCode: 409,
                    message: "User already has an active subscription for this plan",
                };
            }
            throw error;
        }
    }
    /**
     * If cancelAtPeriodEnd=true => you might want to set cancel_at instead of ending now.
     * But your current behavior ends subscription now, so keeping same behavior.
     */
    async cancelSubscriptionNow(userId) {
        return data_source_1.default.transaction(async (trx) => {
            const repo = trx.getRepository(UserSubscription_1.UserSubscription);
            const activeSubs = await repo.find({
                where: { userId: userId, statusV2: subscriberPlan_enum_1.SubscriptionStatus.ACTIVE },
            });
            await repo.update({ userId: userId, statusV2: subscriberPlan_enum_1.SubscriptionStatus.ACTIVE }, {
                statusV2: subscriberPlan_enum_1.SubscriptionStatus.CANCELED,
                status: "canceled",
                canceledAt: new Date(),
                endDate: new Date(),
                executionEnabled: false,
            });
            for (const subscription of activeSubs) {
                await this.stopStrategyInstancesForSubscription(Number(subscription.id), trx);
            }
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
                plan: {
                    planStrategies: {
                        strategy: true,
                    },
                },
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
            .leftJoinAndSelect("plan.planStrategies", "planStrategies")
            .leftJoinAndSelect("planStrategies.strategy", "strategy")
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
    async saveWebhookSettings(userId, payload) {
        const qb = this.subRepo
            .createQueryBuilder("sub")
            .leftJoinAndSelect("sub.plan", "plan")
            .where("sub.user_id = :userId", { userId });
        if (payload.subscriptionId) {
            qb.andWhere("sub.id = :subscriptionId", { subscriptionId: payload.subscriptionId });
        }
        else if (payload.planId) {
            qb.andWhere("sub.plan_id = :planId", { planId: payload.planId });
        }
        const sub = await qb.orderBy("sub.updated_at", "DESC").getOne();
        if (!sub) {
            throw { statusCode: 404, message: "subscription_not_found" };
        }
        let defaultTradingAccountId = payload.defaultTradingAccountId ?? null;
        if (defaultTradingAccountId) {
            const account = await data_source_1.default.query(`
        SELECT id
        FROM user_trading_accounts
        WHERE id = $1
          AND user_id = $2
          AND is_enabled = true
        `, [defaultTradingAccountId, userId]);
            if (!account[0]) {
                throw { statusCode: 400, message: "invalid_default_trading_account" };
            }
        }
        sub.isWebhookEnabled = Boolean(payload.isWebhookEnabled);
        sub.metadata = {
            ...(sub.metadata ?? {}),
            webhookSettings: {
                ...((sub.metadata ?? {}).webhookSettings ?? {}),
                isWebhookEnabled: Boolean(payload.isWebhookEnabled),
                defaultTradingAccountId,
                payloadDefaults: payload.payloadDefaults && typeof payload.payloadDefaults === "object"
                    ? payload.payloadDefaults
                    : {},
            },
        };
        const saved = sub.isWebhookEnabled
            ? await this.ensureWebhookToken(sub)
            : await this.subRepo.save(sub);
        return {
            id: Number(saved.id),
            subscriptionId: Number(saved.id),
            planId: Number(saved.planId),
            isWebhookEnabled: Boolean(saved.isWebhookEnabled),
            webhookToken: saved.webhookToken,
            defaultTradingAccountId,
            payloadDefaults: (saved.metadata ?? {}).webhookSettings?.payloadDefaults ?? {},
            metadata: saved.metadata ?? {},
        };
    }
}
exports.UserSubscriptionDBService = UserSubscriptionDBService;
