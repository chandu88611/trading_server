import { Brackets, DeepPartial, EntityManager, In, Repository } from "typeorm";
import AppDataSource from "../../../db/data-source";

import { UserSubscription } from "../../../entity/UserSubscription";
import { SubscriptionPlan } from "../../../entity/SubscriptionPlan";

import { signWebhookToken } from "../../../middleware/auth";
import {
  SubscriptionStatus,
  UserStrategyStatus,
} from "../../subscriptionPlan/enums/subscriberPlan.enum";
import { MarketType } from "../../../types/trade-identify";
import { CopyTradingFollowers } from "../../../entity/CopyTradingFollow";
import { PlanStrategy } from "../../../entity/PlanStrategy";
import { UserStrategyInstance } from "../../../entity/UserStrategyInstance";

const DEFAULT_STRATEGY_VOLUME = "0.01";

export class UserSubscriptionDBService {
  private subRepo: Repository<UserSubscription>;
  private planRepo: Repository<SubscriptionPlan>;
  private copyTradingFollowersRepo: Repository<CopyTradingFollowers>;
  private userStrategyInstanceRepo: Repository<UserStrategyInstance>;

  constructor() {
    this.subRepo = AppDataSource.getRepository(UserSubscription);
    this.planRepo = AppDataSource.getRepository(SubscriptionPlan);
    this.copyTradingFollowersRepo = AppDataSource.getRepository(CopyTradingFollowers);
    this.userStrategyInstanceRepo = AppDataSource.getRepository(UserStrategyInstance);
  }

  private getManager(manager?: EntityManager) {
    return manager ?? this.subRepo.manager;
  }

  async ensureSchema() {
    await AppDataSource.query(`
      ALTER TABLE user_subscriptions
      ADD COLUMN IF NOT EXISTS status TEXT;
    `);

    await AppDataSource.query(`
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

    await AppDataSource.query(`
      UPDATE user_subscriptions
      SET status = status_v2::text
      WHERE status_v2 IS NOT NULL
        AND COALESCE(status, '') <> status_v2::text;
    `);

    await AppDataSource.query(`
      DROP INDEX IF EXISTS uq_user_subscriptions_id_user;
    `);

    await AppDataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_user_subscriptions_id_user
      ON user_subscriptions(user_id, plan_id)
      WHERE status_v2 = 'active'::subscription_status;
    `);

    await AppDataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_user_subscriptions_webhook_token
      ON user_subscriptions(webhook_token)
      WHERE webhook_token IS NOT NULL;
    `);
  }

  async ensureWebhookToken(
    subscription: UserSubscription,
    manager?: EntityManager
  ): Promise<UserSubscription> {
    if (subscription.webhookToken) {
      return subscription;
    }

    const token = signWebhookToken(
      {
        userId: Number(subscription.userId),
        subscriptionId: Number(subscription.id),
        planId: Number(subscription.planId),
      },
      subscription.endDate ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    );

    subscription.webhookToken = token;
    return this.getManager(manager).getRepository(UserSubscription).save(subscription);
  }

  async getPlanStrategy(planId: number, manager?: EntityManager) {
    return this.getManager(manager)
      .getRepository(PlanStrategy)
      .createQueryBuilder("planStrategy")
      .leftJoinAndSelect("planStrategy.strategy", "strategy")
      .where("planStrategy.plan_id = :planId", { planId })
      .orderBy("planStrategy.created_at", "ASC")
      .addOrderBy("planStrategy.id", "ASC")
      .getOne();
  }

  async upsertStrategyInstanceForSubscription(
    subscription: UserSubscription,
    manager?: EntityManager
  ): Promise<UserStrategyInstance | null> {
    const entityManager = this.getManager(manager);
    const planStrategy = await this.getPlanStrategy(Number(subscription.planId), entityManager);
    if (!planStrategy || !planStrategy.strategy) {
      return null;
    }

    const repo = entityManager.getRepository(UserStrategyInstance);
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
      status: UserStrategyStatus.ACTIVE,
      pausedAt: null,
      stoppedAt: null,
      volume: existing?.volume ?? DEFAULT_STRATEGY_VOLUME,
      activatedAt: existing?.activatedAt ?? new Date(),
    });

    return repo.save(next);
  }

  async stopStrategyInstancesForSubscription(
    subscriptionId: number,
    manager?: EntityManager
  ): Promise<void> {
    await this.getManager(manager)
      .createQueryBuilder()
      .update(UserStrategyInstance)
      .set({
        status: UserStrategyStatus.STOPPED,
        stoppedAt: new Date(),
        updatedAt: new Date(),
      })
      .where("subscription_id = :subscriptionId", { subscriptionId })
      .andWhere("status != :status", { status: UserStrategyStatus.STOPPED })
      .execute();
  }

  async getStrategyInstancesForSubscriptions(
    userId: number,
    subscriptionIds: number[]
  ): Promise<UserStrategyInstance[]> {
    if (!subscriptionIds.length) {
      return [];
    }

    return this.userStrategyInstanceRepo.find({
      where: {
        userId,
        subscriptionId: In(subscriptionIds),
      },
      relations: {
        strategy: true,
      },
    });
  }

  async getStrategyInstancesBySubscriptionIds(
    subscriptionIds: number[]
  ): Promise<UserStrategyInstance[]> {
    if (!subscriptionIds.length) {
      return [];
    }

    return this.userStrategyInstanceRepo.find({
      where: {
        subscriptionId: In(subscriptionIds),
      },
      relations: {
        strategy: true,
      },
    });
  }

  async getActiveStrategySubscriptionsForPlan(planId: number): Promise<UserSubscription[]> {
    return this.subRepo
      .createQueryBuilder("subscription")
      .leftJoinAndSelect("subscription.user", "user")
      .leftJoinAndSelect("subscription.plan", "plan")
      .leftJoinAndSelect("plan.market", "market")
      .leftJoinAndSelect("plan.planStrategies", "planStrategies")
      .leftJoinAndSelect("planStrategies.strategy", "strategy")
      .where("subscription.plan_id = :planId", { planId })
      .andWhere("subscription.status_v2 = :status", {
        status: SubscriptionStatus.ACTIVE,
      })
      .andWhere("COALESCE(user.is_admin, false) = false")
      .orderBy("subscription.created_at", "DESC")
      .getMany();
  }

  async getActiveSubscription(userId: number, plan?: SubscriptionPlan) {
    let query =   this.subRepo.createQueryBuilder("us")
    .leftJoinAndSelect("us.plan", "plan")
    .leftJoinAndSelect("plan.planStrategies", "planStrategies")
    .leftJoinAndSelect("planStrategies.strategy", "strategy")
    .where("us.user_id = :userId", { userId })
    .andWhere("us.status_v2 = :status", { status: SubscriptionStatus.ACTIVE })
    .andWhere("plan.is_active = true")
    if(plan){
      query.andWhere("plan.id = :planId", { planId: plan.id })
    }
    const data = await query.getMany();
    console.log("getActiveSubscription", { userId, data });
    return data

  }

  async getActiveSubscriptionById(userId: number, subscriptionId: number) {
    return this.subRepo.findOne({
      where: {
        id: subscriptionId as any,
        userId: userId as any,
        statusV2: SubscriptionStatus.ACTIVE as any,
      } as any,
      relations: {
        plan: {
          market: true,
          planStrategies: {
            strategy: true,
          },
        },
      } as any,
    });
  }

    async getActiveSubscriptionCurrent(userId: number,start: number, count: number,  searchParams?: any) {
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
        let data =  this.subRepo.createQueryBuilder("us")
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
        .andWhere("us.status_v2 = :status", { status: SubscriptionStatus.ACTIVE })
        .andWhere("plan.is_active = true")
        if(searchParams){
          if(searchParams.market){
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
      } catch (error) {
        throw error
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

  async getFollowerUserTradingAccount(userId: number, start: number, count: number, searchParams?: any) {
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
    } catch (error) {
      throw error;
    }
  }

  /**
   * New design:
   * - planId is BIGINT (number)
   * - need pricing relation (interval is there)
   * - ensure isActive = true
   */
  getPlan(planId: number) {
    return this.planRepo.findOne({
      where: { id: planId, isActive: true } as any,
      relations: {
        pricing: true,
        planType: true,
        market: true,
        planStrategies: {
          strategy: true,
        },
      } as any,
    });
  }

  async createSubscription(userId: number, planId: number, durationDays: number) {
    const now = new Date();
    const end = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    const data: DeepPartial<UserSubscription> = {
      userId: userId as any,
      planId: planId as any, // BIGINT (number)
      startDate: now,
      endDate: end,

      // NEW enum column
      statusV2: SubscriptionStatus.ACTIVE as any,

      // legacy column (text) - keep in sync
      status: "active",

      executionEnabled: true,
      webhookToken: null,
      metadata: null,
    } as any;

    try {
      const sub = this.subRepo.create(data);
      const saved = await this.subRepo.save(sub);
      const withToken = await this.ensureWebhookToken(saved);
      await this.upsertStrategyInstanceForSubscription(withToken);
      return withToken;
    } catch (error: any) {
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
  async cancelSubscriptionNow(userId: number) {
    return AppDataSource.transaction(async (trx) => {
      const repo = trx.getRepository(UserSubscription);
      const activeSubs = await repo.find({
        where: { userId: userId as any, statusV2: SubscriptionStatus.ACTIVE as any } as any,
      });

      await repo.update(
        { userId: userId as any, statusV2: SubscriptionStatus.ACTIVE as any } as any,
        {
          statusV2: SubscriptionStatus.CANCELED as any,
          status: "canceled",
          canceledAt: new Date(),
          endDate: new Date(),
          executionEnabled: false,
        } as any
      );

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
  async cancelAtPeriodEnd(userId: number) {
    return this.subRepo.update(
      { userId: userId as any, statusV2: SubscriptionStatus.ACTIVE as any } as any,
      {
        cancelAt: new Date(), // "request time" (you can change semantics)
      } as any
    );
  }

  getAllUserSubscriptions(offset = 0, limit = 20) {
    return this.subRepo.findAndCount({
      skip: offset,
      take: limit,
      relations: {
        plan: true,
      } as any,
      order: { createdAt: "DESC" } as any,
    });
  }

  getUserSubscriptions(userId: number) {
    return this.subRepo.find({
      where: { userId: userId as any } as any,
      relations: {
        plan: {
          planStrategies: {
            strategy: true,
          },
        },
      } as any,
      order: { createdAt: "DESC" } as any,
    });
  }

  /**
   * New design:
   * old code: plan.category = assetType
   * new code: use plan.market.code (FOREX/CRYPTO/INDIAN) to validate
   */
  async subscriberPlanValidation(userId: number, marketType: MarketType) {
    const qb = this.subRepo
      .createQueryBuilder("us")
      .innerJoinAndSelect("us.plan", "plan")
      .leftJoinAndSelect("plan.planStrategies", "planStrategies")
      .leftJoinAndSelect("planStrategies.strategy", "strategy")
      .leftJoinAndSelect("plan.market", "market")
      .where("us.user_id = :userId", { userId })
      .andWhere("us.status_v2 = :status", { status: SubscriptionStatus.ACTIVE })
      .andWhere("plan.is_active = true")
      .andWhere(
        new Brackets((q) => {
          q.where("plan.market_id IS NULL")        
           .orWhere("market.code = :mc", { mc: marketType }); 
        })
      );
    const data = await qb.getOne();
    return data || null;
  }

  async updateSubscriptionWebhookStatus(subscriptionId: number, isEnabled: boolean) {
    try {
      await this.subRepo.update(
        { id: subscriptionId } as any,
        {
          isWebhookEnabled: isEnabled,
        } as any
      );
    } catch (error) {
      throw error
    }
  }

  async saveWebhookSettings(
    userId: number,
    payload: {
      subscriptionId?: number | null;
      planId?: number | null;
      isWebhookEnabled: boolean;
      defaultTradingAccountId?: number | null;
      payloadDefaults?: Record<string, any>;
    }
  ) {
    const qb = this.subRepo
      .createQueryBuilder("sub")
      .leftJoinAndSelect("sub.plan", "plan")
      .where("sub.user_id = :userId", { userId });

    if (payload.subscriptionId) {
      qb.andWhere("sub.id = :subscriptionId", { subscriptionId: payload.subscriptionId });
    } else if (payload.planId) {
      qb.andWhere("sub.plan_id = :planId", { planId: payload.planId });
    }

    const sub = await qb.orderBy("sub.updated_at", "DESC").getOne();
    if (!sub) {
      throw { statusCode: 404, message: "subscription_not_found" };
    }

    let defaultTradingAccountId = payload.defaultTradingAccountId ?? null;
    if (defaultTradingAccountId) {
      const account = await AppDataSource.query(
        `
        SELECT id
        FROM user_trading_accounts
        WHERE id = $1
          AND user_id = $2
          AND is_enabled = true
        `,
        [defaultTradingAccountId, userId]
      );
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
        payloadDefaults:
          payload.payloadDefaults && typeof payload.payloadDefaults === "object"
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
