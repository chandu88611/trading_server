import test from "node:test";
import assert from "node:assert/strict";

const AppDataSource = require("../../db/data-source").default;
const { UserDBService } = require("../../app/user/services/user.db");
const { UserService } = require("../../app/user/services/user.service");
const {
  SubscriptionStatus,
  TradingAccountStatus,
} = require("../../app/subscriptionPlan/enums/subscriberPlan.enum");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

function createSubscription(params: {
  id: number;
  userId: number;
  planId: number;
  status: string | null;
  createdAt: string;
  endDate?: string | null;
  cancelAt?: string | null;
  planName: string;
  marketCode?: string | null;
  marketName?: string | null;
  planTypeCode?: string;
}) {
  return {
    id: params.id,
    userId: params.userId,
    planId: params.planId,
    statusV2: params.status,
    autoRenew: true,
    executionEnabled: true,
    isWebhookEnabled: false,
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: params.endDate ? new Date(params.endDate) : null,
    cancelAt: params.cancelAt ? new Date(params.cancelAt) : null,
    createdAt: new Date(params.createdAt),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    plan: {
      id: params.planId,
      name: params.planName,
      description: `${params.planName} description`,
      isActive: true,
      market: params.marketCode && params.marketName
        ? {
            id: params.planId + 1000,
            code: params.marketCode,
            name: params.marketName,
          }
        : null,
      planType: {
        id: String(params.planId + 2000),
        code: params.planTypeCode ?? "SELF_TRADE",
        name: "Self Trade",
      },
      pricing: {
        priceInr: 999,
        currency: "INR",
        interval: "monthly",
        isFree: false,
      },
    },
  };
}

function createAccount(params: {
  id: number;
  userId: number;
  subscriptionId: number | null;
  accountId: string;
  accountLabel: string | null;
  createdAt: string;
  brokerCode: string;
  brokerName: string;
  brokerMarketCategory: string;
  planName?: string | null;
  planId?: number | null;
  planMarketCode?: string | null;
  planMarketName?: string | null;
}) {
  return {
    id: params.id,
    userId: params.userId,
    subscriptionId: params.subscriptionId,
    accountId: params.accountId,
    accountLabel: params.accountLabel,
    isMaster: false,
    brokerId: params.id + 10,
    broker: {
      id: params.id + 10,
      code: params.brokerCode,
      name: params.brokerName,
      marketCategory: params.brokerMarketCategory,
      isActive: true,
    },
    accountMeta: {
      secret: "should-not-leak",
    },
    credentialsEncrypted: "encrypted",
    accessToken: "access-token",
    refreshToken: "refresh-token",
    isEnabled: true,
    status: TradingAccountStatus.VERIFIED,
    lastVerifiedAt: new Date("2026-03-02T00:00:00.000Z"),
    createdAt: new Date(params.createdAt),
    updatedAt: new Date("2026-03-03T00:00:00.000Z"),
    subscription: params.subscriptionId
      ? {
          id: params.subscriptionId,
          planId: params.planId,
          statusV2: SubscriptionStatus.ACTIVE,
          plan: params.planId
            ? {
                id: params.planId,
                name: params.planName ?? null,
                market:
                  params.planMarketCode && params.planMarketName
                    ? {
                        id: params.planId + 5000,
                        code: params.planMarketCode,
                        name: params.planMarketName,
                      }
                    : null,
              }
            : null,
        }
      : null,
  };
}

test("UserService: getDashboardData splits plans, buckets trades, zeros missing accounts, and omits secrets", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreGetDashboardUserProfile = patch(
    UserDBService.prototype,
    "getDashboardUserProfile",
    async () => ({
      id: 77,
      email: "dashboard@example.com",
      name: "Dashboard User",
      isEmailVerified: true,
      isActive: true,
      isAdmin: false,
      allowTrade: true,
      allowCopyTrade: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      lastLoginAt: new Date("2026-01-03T00:00:00.000Z"),
    })
  );
  const restoreGetDashboardSubscriptions = patch(
    UserDBService.prototype,
    "getDashboardSubscriptions",
    async () => [
      createSubscription({
        id: 1,
        userId: 77,
        planId: 101,
        status: SubscriptionStatus.ACTIVE,
        createdAt: "2026-02-01T00:00:00.000Z",
        planName: "Starter",
        marketCode: "FOREX",
        marketName: "Forex",
      }),
      createSubscription({
        id: 2,
        userId: 77,
        planId: 102,
        status: SubscriptionStatus.ACTIVE,
        createdAt: "2026-03-01T00:00:00.000Z",
        planName: "Pro",
        marketCode: "CRYPTO",
        marketName: "Crypto",
      }),
      createSubscription({
        id: 3,
        userId: 77,
        planId: 103,
        status: SubscriptionStatus.CANCELED,
        createdAt: "2026-01-10T00:00:00.000Z",
        endDate: "2026-02-20T00:00:00.000Z",
        planName: "Legacy",
      }),
      createSubscription({
        id: 4,
        userId: 77,
        planId: 104,
        status: SubscriptionStatus.EXPIRED,
        createdAt: "2026-01-11T00:00:00.000Z",
        endDate: "2026-03-15T00:00:00.000Z",
        planName: "Expired",
      }),
      createSubscription({
        id: 5,
        userId: 77,
        planId: 105,
        status: SubscriptionStatus.PAUSED,
        createdAt: "2026-01-12T00:00:00.000Z",
        endDate: null,
        planName: "Paused",
      }),
    ]
  );
  const restoreGetDashboardAccounts = patch(
    UserDBService.prototype,
    "getDashboardAccounts",
    async () => [
      createAccount({
        id: 501,
        userId: 77,
        subscriptionId: 9001,
        accountId: "ACC-1",
        accountLabel: "Primary",
        createdAt: "2026-03-04T00:00:00.000Z",
        brokerCode: "CT",
        brokerName: "cTrader",
        brokerMarketCategory: "FOREX",
        planId: 102,
        planName: "Pro",
        planMarketCode: "FOREX",
        planMarketName: "Forex",
      }),
      createAccount({
        id: 502,
        userId: 77,
        subscriptionId: null,
        accountId: "ACC-2",
        accountLabel: "Secondary",
        createdAt: "2026-03-03T00:00:00.000Z",
        brokerCode: "DHAN",
        brokerName: "Dhan",
        brokerMarketCategory: "INDIA",
      }),
    ]
  );
  const restoreGetDashboardTradeCountsByAccount = patch(
    UserDBService.prototype,
    "getDashboardTradeCountsByAccount",
    async () => [
      {
        tradingAccountId: 501,
        active: 3,
        closed: 2,
        failed: 1,
        total: 6,
      },
    ]
  );
  const restoreGetStrategyInstancesForSubscriptions = patch(
    require("../../app/userSubscription/services/userSubscription.db").UserSubscriptionDBService.prototype,
    "getStrategyInstancesForSubscriptions",
    async () => []
  );

  try {
    const service = new UserService();
    const result = await service.getDashboardData(77);

    assert.deepEqual(
      result.plans.active.map((plan: { id: number }) => plan.id),
      [2, 1]
    );
    assert.deepEqual(
      result.plans.past.map((plan: { id: number }) => plan.id),
      [4, 3, 5]
    );
    assert.deepEqual(result.stats.trades, {
      active: 3,
      closed: 2,
      failed: 1,
      total: 6,
    });
    assert.deepEqual(result.accounts[0].tradeCounts, {
      active: 3,
      closed: 2,
      failed: 1,
      total: 6,
    });
    assert.deepEqual(result.accounts[1].tradeCounts, {
      active: 0,
      closed: 0,
      failed: 0,
      total: 0,
    });
    assert.equal(
      Object.prototype.hasOwnProperty.call(result.accounts[0], "credentialsEncrypted"),
      false
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(result.accounts[0], "accessToken"),
      false
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(result.accounts[0], "refreshToken"),
      false
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(result.accounts[0], "accountMeta"),
      false
    );
  } finally {
    restoreGetStrategyInstancesForSubscriptions();
    restoreGetDashboardTradeCountsByAccount();
    restoreGetDashboardAccounts();
    restoreGetDashboardSubscriptions();
    restoreGetDashboardUserProfile();
    restoreGetRepository();
  }
});

test("UserService: getDashboardData returns empty dashboard state when user has no plans, trades, or accounts", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreGetDashboardUserProfile = patch(
    UserDBService.prototype,
    "getDashboardUserProfile",
    async () => ({
      id: 88,
      email: "empty@example.com",
      name: null,
      isEmailVerified: false,
      isActive: true,
      isAdmin: false,
      allowTrade: false,
      allowCopyTrade: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      lastLoginAt: null,
    })
  );
  const restoreGetDashboardSubscriptions = patch(
    UserDBService.prototype,
    "getDashboardSubscriptions",
    async () => []
  );
  const restoreGetDashboardAccounts = patch(
    UserDBService.prototype,
    "getDashboardAccounts",
    async () => []
  );
  const restoreGetDashboardTradeCountsByAccount = patch(
    UserDBService.prototype,
    "getDashboardTradeCountsByAccount",
    async () => []
  );
  const restoreGetStrategyInstancesForSubscriptions = patch(
    require("../../app/userSubscription/services/userSubscription.db").UserSubscriptionDBService.prototype,
    "getStrategyInstancesForSubscriptions",
    async () => []
  );

  try {
    const service = new UserService();
    const result = await service.getDashboardData(88);

    assert.deepEqual(result.stats.trades, {
      active: 0,
      closed: 0,
      failed: 0,
      total: 0,
    });
    assert.deepEqual(result.plans, {
      active: [],
      past: [],
    });
    assert.deepEqual(result.accounts, []);
  } finally {
    restoreGetStrategyInstancesForSubscriptions();
    restoreGetDashboardTradeCountsByAccount();
    restoreGetDashboardAccounts();
    restoreGetDashboardSubscriptions();
    restoreGetDashboardUserProfile();
    restoreGetRepository();
  }
});

test("UserService: getDashboardData includes strategy status and volume on subscriptions", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreGetDashboardUserProfile = patch(
    UserDBService.prototype,
    "getDashboardUserProfile",
    async () => ({
      id: 99,
      email: "strategy@example.com",
      name: "Strategy User",
      isEmailVerified: true,
      isActive: true,
      isAdmin: false,
      allowTrade: true,
      allowCopyTrade: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      lastLoginAt: null,
    })
  );
  const restoreGetDashboardSubscriptions = patch(
    UserDBService.prototype,
    "getDashboardSubscriptions",
    async () => [
      {
        ...createSubscription({
          id: 10,
          userId: 99,
          planId: 700,
          status: "active",
          createdAt: "2026-03-01T00:00:00.000Z",
          planName: "Managed Strategy",
          marketCode: "FOREX",
          marketName: "Forex",
        }),
        plan: {
          ...createSubscription({
            id: 10,
            userId: 99,
            planId: 700,
            status: "active",
            createdAt: "2026-03-01T00:00:00.000Z",
            planName: "Managed Strategy",
            marketCode: "FOREX",
            marketName: "Forex",
          }).plan,
          planStrategies: [
            {
              strategy: {
                id: 123,
                strategyCode: "EMA_1",
                name: "EMA One",
                isActive: true,
              },
            },
          ],
        },
      },
    ]
  );
  const restoreGetDashboardAccounts = patch(
    UserDBService.prototype,
    "getDashboardAccounts",
    async () => []
  );
  const restoreGetDashboardTradeCountsByAccount = patch(
    UserDBService.prototype,
    "getDashboardTradeCountsByAccount",
    async () => []
  );
  const restoreGetStrategyInstancesForSubscriptions = patch(
    require("../../app/userSubscription/services/userSubscription.db").UserSubscriptionDBService.prototype,
    "getStrategyInstancesForSubscriptions",
    async () => [
      {
        id: 555,
        subscriptionId: 10,
        volume: "0.08",
        status: "active",
        strategy: {
          id: 123,
          strategyCode: "EMA_1",
          name: "EMA One",
          isActive: true,
        },
      },
    ]
  );

  try {
    const service = new UserService();
    const result = await service.getDashboardData(99);

    assert.deepEqual(result.plans.active[0].strategy, {
      instanceId: 555,
      status: "active",
      volume: 0.08,
      definition: {
        id: 123,
        strategyCode: "EMA_1",
        name: "EMA One",
        isActive: true,
      },
      managedByAdminWebhook: true,
    });
  } finally {
    restoreGetStrategyInstancesForSubscriptions();
    restoreGetDashboardTradeCountsByAccount();
    restoreGetDashboardAccounts();
    restoreGetDashboardSubscriptions();
    restoreGetDashboardUserProfile();
    restoreGetRepository();
  }
});
