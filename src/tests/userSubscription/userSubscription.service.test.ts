import test from "node:test";
import assert from "node:assert/strict";

const AppDataSource = require("../../db/data-source").default;
const { UserSubscriptionDBService } = require("../../app/userSubscription/services/userSubscription.db");
const { UserSubscriptionService } = require("../../app/userSubscription/services/userSubscription");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

test("UserSubscriptionService: getCurrentSubscription includes strategy state and singular plan strategy", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));

  const restoreGetActiveSubscriptionCurrent = patch(
    UserSubscriptionDBService.prototype,
    "getActiveSubscriptionCurrent",
    async () => ({
      data: [
        {
          id: 10,
          userId: 77,
          planId: 200,
          plan: {
            id: 200,
            name: "Managed Signals",
            planStrategies: [
              {
                id: 2,
                createdAt: new Date("2026-03-01T00:00:01.000Z"),
                strategy: {
                  id: 301,
                  strategyCode: "LATE_ENTRY",
                  name: "Late Entry",
                  isActive: true,
                },
              },
              {
                id: 1,
                createdAt: new Date("2026-03-01T00:00:00.000Z"),
                strategy: {
                  id: 300,
                  strategyCode: "EMA_TREND",
                  name: "EMA Trend",
                  isActive: true,
                },
              },
            ],
          },
        },
      ],
      followers: [],
    })
  );

  const restoreGetStrategyInstancesForSubscriptions = patch(
    UserSubscriptionDBService.prototype,
    "getStrategyInstancesForSubscriptions",
    async () => [
      {
        id: 999,
        subscriptionId: 10,
        volume: "0.06",
        status: "active",
        strategy: {
          id: 300,
          strategyCode: "EMA_TREND",
          name: "EMA Trend",
          isActive: true,
        },
      },
    ]
  );

  try {
    const service = new UserSubscriptionService();
    const result = await service.getCurrentSubscription(77, 0, 20);

    assert.deepEqual(result.data[0].strategy, {
      instanceId: 999,
      status: "active",
      volume: 0.06,
      definition: {
        id: 300,
        strategyCode: "EMA_TREND",
        name: "EMA Trend",
        isActive: true,
      },
      managedByAdminWebhook: true,
    });
    assert.deepEqual(result.data[0].plan.strategy, {
      id: 300,
      strategyCode: "EMA_TREND",
      name: "EMA Trend",
      isActive: true,
    });
    assert.equal(result.data[0].plan.planStrategies.length, 1);
  } finally {
    restoreGetStrategyInstancesForSubscriptions();
    restoreGetActiveSubscriptionCurrent();
    restoreGetRepository();
  }
});

test("UserSubscriptionService: subscribe rejects unavailable strategy plans for new subscriptions", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreGetPlan = patch(
    UserSubscriptionDBService.prototype,
    "getPlan",
    async () => ({
      id: 200,
      isActive: true,
      pricing: { interval: "monthly", isFree: true, priceInr: 0 },
      planStrategies: [
        {
          strategyId: 300,
          strategy: {
            id: 300,
            strategyCode: "STRAT_1",
            name: "Strategy 1",
            isActive: false,
            isDeprecated: true,
          },
        },
      ],
    })
  );
  const restoreGetActiveSubscription = patch(
    UserSubscriptionDBService.prototype,
    "getActiveSubscription",
    async () => []
  );
  const restoreCreateSubscription = patch(
    UserSubscriptionDBService.prototype,
    "createSubscription",
    async () => {
      throw new Error("createSubscription should not be called");
    }
  );

  try {
    const service = new UserSubscriptionService();
    await assert.rejects(
      () => service.subscribe(77, { planId: 200 } as any),
      (error: any) => {
        assert.equal(error.statusCode, 400);
        assert.equal(error.message, "strategy_unavailable_for_new_subscription");
        return true;
      }
    );
  } finally {
    restoreCreateSubscription();
    restoreGetActiveSubscription();
    restoreGetPlan();
    restoreGetRepository();
  }
});
