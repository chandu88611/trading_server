import test from "node:test";
import assert from "node:assert/strict";

const { SubscriptionPlanService } = require("../../app/subscriptionPlan/services/subscriptionPlan");

test("SubscriptionPlanService: getPlans annotates active subscriptions for the viewer", async () => {
  const service = new SubscriptionPlanService();

  (service as any).db = {
    async getPlans() {
      return [
        [
          { id: 1, name: "Starter" },
          { id: 2, name: "Pro" },
          { id: "3", name: "Elite" },
        ],
        3,
      ];
    },
  };

  (service as any).userSubscriptionDb = {
    async getActiveSubscription() {
      return [
        { planId: 2 },
        { planId: "3" },
        { planId: "3" },
        { planId: "not-a-number" },
      ];
    },
  };

  const result = await service.getPlans({}, 44);

  assert.equal(result.total, 3);
  assert.equal(result.subscriberHasAnyActivePlan, true);
  assert.deepEqual(result.subscriberActivePlanIds, [2, 3]);
  assert.equal(result.rows[0].subscriberAlreadyHasPlan, false);
  assert.equal(result.rows[1].subscriberAlreadyHasPlan, true);
  assert.equal(result.rows[2].subscriberAlreadyHasPlan, true);
});

test("SubscriptionPlanService: getPlans leaves subscriber flags empty for anonymous viewers", async () => {
  const service = new SubscriptionPlanService();
  let activeSubscriptionLookupCount = 0;

  (service as any).db = {
    async getPlans() {
      return [[{ id: 10, name: "Signals" }], 1];
    },
  };

  (service as any).userSubscriptionDb = {
    async getActiveSubscription() {
      activeSubscriptionLookupCount += 1;
      return [{ planId: 10 }];
    },
  };

  const result = await service.getPlans({}, null);

  assert.equal(activeSubscriptionLookupCount, 0);
  assert.equal(result.total, 1);
  assert.equal(result.subscriberHasAnyActivePlan, false);
  assert.deepEqual(result.subscriberActivePlanIds, []);
  assert.equal(result.rows[0].subscriberAlreadyHasPlan, false);
});

test("SubscriptionPlanService: createPlan forwards singular strategyId", async () => {
  const service = new SubscriptionPlanService();
  let capturedPayload: any = null;

  (service as any).db = {
    async createPlan(payload: any) {
      capturedPayload = payload;
      return { id: 10, ...payload, planStrategies: [] };
    },
  };

  const result = await service.createPlan({
    name: "Signals",
    planTypeCode: "SELF_TRADE" as any,
    strategyId: 55,
  });

  assert.equal(capturedPayload.strategyId, 55);
  assert.equal((result as any).strategy, null);
});

test("SubscriptionPlanService: createPlan rejects more than one strategy", async () => {
  const service = new SubscriptionPlanService();

  await assert.rejects(
    () =>
      service.createPlan({
        name: "Signals",
        planTypeCode: "SELF_TRADE" as any,
        strategyIds: [11, 22],
      } as any),
    (error: any) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.message, "only_one_strategy_per_plan");
      return true;
    }
  );
});

test("SubscriptionPlanService: createPlan chooses a deterministic primary strategy", async () => {
  const service = new SubscriptionPlanService();

  (service as any).db = {
    async createPlan(payload: any) {
      return {
        id: 10,
        ...payload,
        planStrategies: [
          {
            id: 22,
            createdAt: new Date("2026-02-26T16:26:24.855Z"),
            strategy: {
              id: 200,
              strategyCode: "SECONDARY",
              name: "Secondary",
              isActive: true,
            },
          },
          {
            id: 21,
            createdAt: new Date("2026-02-26T16:26:24.854Z"),
            strategy: {
              id: 100,
              strategyCode: "PRIMARY",
              name: "Primary",
              isActive: true,
            },
          },
        ],
      };
    },
  };

  const result = await service.createPlan({
    name: "Signals",
    planTypeCode: "SELF_TRADE" as any,
    strategyId: 55,
  });

  assert.equal((result as any).planStrategies.length, 1);
  assert.equal((result as any).planStrategies[0].strategy.id, 100);
  assert.deepEqual((result as any).strategy, {
    id: 100,
    strategyCode: "PRIMARY",
    name: "Primary",
    isActive: true,
  });
});
