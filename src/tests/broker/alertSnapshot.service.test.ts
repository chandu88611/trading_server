import test from "node:test";
import assert from "node:assert/strict";

const AppDataSource = require("../../db/data-source").default;
const { AlertSnapshotService } = require("../../app/broker/brokerAlerts/services/alertSnapshot.service");
const { UserStrategyStatus } = require("../../app/subscriptionPlan/enums/subscriberPlan.enum");
const { AssetType } = require("../../types/trade-identify");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

test("AlertSnapshotService: createForPlan ignores catalog inactive state for existing active strategy instances", async () => {
  const createdSignals: any[] = [];
  let snapshotId = 1000;

  const restoreCreateQueryRunner = patch(AppDataSource, "createQueryRunner", () => ({
    connect: async () => undefined,
    startTransaction: async () => undefined,
    commitTransaction: async () => undefined,
    rollbackTransaction: async () => undefined,
    release: async () => undefined,
    manager: {},
  }));

  try {
    const service = new AlertSnapshotService();

    (service as any).subscriptionPlanService = {
      async getPlan() {
        return {
          id: 200,
          isActive: true,
          market: { code: "FOREX" },
          strategy: {
            id: 300,
            strategyCode: "STRAT_1",
            name: "Strategy 1",
            isActive: false,
            isDeprecated: true,
          },
        };
      },
    };

    (service as any).userSubscriptionDbService = {
      async getActiveStrategySubscriptionsForPlan() {
        return [
          { id: 1, userId: 10, executionEnabled: false, user: { isAdmin: false } },
          { id: 2, userId: 20, executionEnabled: true, user: { isAdmin: false } },
          { id: 3, userId: 30, executionEnabled: true, user: { isAdmin: true } },
        ];
      },
      async getStrategyInstancesBySubscriptionIds() {
        return [
          {
            id: 501,
            subscriptionId: 1,
            strategyId: 300,
            status: UserStrategyStatus.ACTIVE,
            volume: "0.07",
            strategy: {
              id: 300,
              strategyCode: "STRAT_1",
              name: "Strategy 1",
              isActive: false,
              isDeprecated: true,
            },
          },
          {
            id: 502,
            subscriptionId: 2,
            strategyId: 300,
            status: UserStrategyStatus.PAUSED,
            volume: "0.09",
            strategy: {
              id: 300,
              strategyCode: "STRAT_1",
              name: "Strategy 1",
              isActive: true,
            },
          },
          {
            id: 503,
            subscriptionId: 3,
            strategyId: 300,
            status: UserStrategyStatus.ACTIVE,
            volume: "0.11",
            strategy: {
              id: 300,
              strategyCode: "STRAT_1",
              name: "Strategy 1",
              isActive: true,
            },
          },
        ];
      },
    };

    (service as any).alertSnapshotDB = {
      async createAdminStrategyTrade(payload: any) {
        return { id: 7000, ...payload };
      },
      async updateAdminStrategyTradeFanout() {
        return undefined;
      },
      async create(payload: any) {
        snapshotId += 1;
        return { id: snapshotId, userId: payload.userId };
      },
      async getBrokerId() {
        return [9];
      },
      async closeOppositeCompletedTrades() {
        return 0;
      },
    };

    (service as any).tradingAccountService = {
      async resolveStrategyExecutionTargets(userId: number, subscriptionId: number) {
        assert.equal(subscriptionId, 1);
        return {
          accounts: [{ userId, id: userId * 10 }],
          eligibleOwnedAccountIds: [userId * 10],
          masterAccountIds: [],
          followerAccountIds: [],
        };
      },
    };

    (service as any).tradeSignalService = {
      async createTradeSignal(payload: any[]) {
        createdSignals.push(...payload);
      },
    };

    (service as any).userDBService = {
      async getEdgingStatus() {
        return { isEnabled: false, userId: "0" };
      },
    };

    const result = await service.createForPlan(200, {
      market: "FOREX",
      ticker: "EURUSD",
      exchange: "OANDA",
      interval: "15",
      barTime: new Date("2026-04-01T00:00:00.000Z"),
      alertTime: new Date("2026-04-01T00:00:00.000Z"),
      open: 1.1,
      close: 1.2,
      high: 1.3,
      low: 1.0,
      volume: 99,
      tradingStrength: 55,
      action: "BUY",
    });

    assert.equal(result.recipientCount, 1);
    assert.equal(result.snapshotCount, 1);
    assert.equal(result.signalCount, 1);
    assert.equal(result.adminStrategyTradeId, 7000);
    assert.equal(createdSignals.length, 1);
    assert.equal(createdSignals[0].userId, 10);
    assert.equal(createdSignals[0].volume, 0.07);
    assert.equal(createdSignals[0].entryRef, null);
    assert.equal(createdSignals[0].adminStrategyTradeId, 7000);
    assert.equal(createdSignals[0].strategyId, 300);
    assert.equal(createdSignals[0].subscriptionId, 1);
  } finally {
    restoreCreateQueryRunner();
  }
});

test("AlertSnapshotService: createForPlan stores snapshots but skips actions when tradingStrength is 40 or below", async () => {
  const createdSignals: any[] = [];
  const createdSnapshots: any[] = [];
  let tradingAccountLookups = 0;
  let snapshotId = 2000;

  const restoreCreateQueryRunner = patch(AppDataSource, "createQueryRunner", () => ({
    connect: async () => undefined,
    startTransaction: async () => undefined,
    commitTransaction: async () => undefined,
    rollbackTransaction: async () => undefined,
    release: async () => undefined,
    manager: {},
  }));

  try {
    const service = new AlertSnapshotService();

    (service as any).subscriptionPlanService = {
      async getPlan() {
        return {
          id: 200,
          isActive: true,
          market: { code: "FOREX" },
          strategy: {
            id: 300,
            strategyCode: "STRAT_1",
            name: "Strategy 1",
            isActive: true,
          },
        };
      },
    };

    (service as any).userSubscriptionDbService = {
      async getActiveStrategySubscriptionsForPlan() {
        return [
          { id: 1, userId: 10, executionEnabled: true, user: { isAdmin: false } },
        ];
      },
      async getStrategyInstancesBySubscriptionIds() {
        return [
          {
            id: 501,
            subscriptionId: 1,
            strategyId: 300,
            status: UserStrategyStatus.ACTIVE,
            volume: "0.07",
            strategy: {
              id: 300,
              strategyCode: "STRAT_1",
              name: "Strategy 1",
              isActive: true,
            },
          },
        ];
      },
    };

    (service as any).alertSnapshotDB = {
      async createAdminStrategyTrade(payload: any) {
        return { id: 7000, ...payload };
      },
      async updateAdminStrategyTradeFanout() {
        return undefined;
      },
      async create(payload: any) {
        createdSnapshots.push(payload);
        snapshotId += 1;
        return { id: snapshotId, userId: payload.userId };
      },
      async getBrokerId() {
        throw new Error("should_not_lookup_brokers_when_trading_strength_is_low");
      },
      async getBrokerIdByCodes() {
        throw new Error("should_not_lookup_brokers_when_trading_strength_is_low");
      },
      async closeOppositeCompletedTrades() {
        return 0;
      },
    };

    (service as any).tradingAccountService = {
      async resolveStrategyExecutionTargets() {
        tradingAccountLookups += 1;
        return {
          accounts: [{ userId: 10, id: 100 }],
          eligibleOwnedAccountIds: [100],
          masterAccountIds: [],
          followerAccountIds: [],
        };
      },
    };

    (service as any).tradeSignalService = {
      async createTradeSignal(payload: any[]) {
        createdSignals.push(...payload);
      },
    };

    const result = await service.createForPlan(200, {
      market: "FOREX",
      ticker: "EURUSD",
      exchange: "OANDA",
      interval: "15",
      barTime: new Date("2026-04-01T00:00:00.000Z"),
      alertTime: new Date("2026-04-01T00:00:00.000Z"),
      open: 1.1,
      close: 1.2,
      high: 1.3,
      low: 1.0,
      volume: 99,
      tradingStrength: 40,
      action: "BUY",
    });

    assert.equal(result.recipientCount, 0);
    assert.equal(result.snapshotCount, 1);
    assert.equal(result.signalCount, 0);
    assert.equal(createdSnapshots.length, 1);
    assert.equal(createdSnapshots[0].tradingStrength, 40);
    assert.equal(tradingAccountLookups, 0);
    assert.equal(createdSignals.length, 0);
  } finally {
    restoreCreateQueryRunner();
  }
});

test("AlertSnapshotService: createForPlan stores snapshots but blocks signal fanout during admin schedule windows", async () => {
  const createdSignals: any[] = [];
  const createdSnapshots: any[] = [];
  let tradingAccountLookups = 0;
  let snapshotId = 2500;

  const restoreCreateQueryRunner = patch(AppDataSource, "createQueryRunner", () => ({
    connect: async () => undefined,
    startTransaction: async () => undefined,
    commitTransaction: async () => undefined,
    rollbackTransaction: async () => undefined,
    release: async () => undefined,
    manager: {},
  }));
  const restoreDateNow = patch(Date, "now", () =>
    new Date("2026-04-21T12:30:00.000Z").getTime()
  );

  try {
    const service = new AlertSnapshotService();

    (service as any).subscriptionPlanService = {
      async getPlan() {
        return {
          id: 200,
          isActive: true,
          market: { code: "FOREX" },
          strategy: {
            id: 300,
            strategyCode: "STRAT_1",
            name: "Strategy 1",
            isActive: true,
          },
        };
      },
    };

    (service as any).userSubscriptionDbService = {
      async getActiveStrategySubscriptionsForPlan() {
        return [
          { id: 1, userId: 10, executionEnabled: true, user: { isAdmin: false } },
        ];
      },
      async getStrategyInstancesBySubscriptionIds() {
        return [
          {
            id: 501,
            subscriptionId: 1,
            strategyId: 300,
            status: UserStrategyStatus.ACTIVE,
            volume: "0.07",
            strategy: {
              id: 300,
              strategyCode: "STRAT_1",
              name: "Strategy 1",
              isActive: true,
            },
          },
        ];
      },
    };

    (service as any).alertSnapshotDB = {
      async createAdminStrategyTrade(payload: any) {
        return { id: 7000, ...payload };
      },
      async updateAdminStrategyTradeFanout() {
        return undefined;
      },
      async create(payload: any) {
        createdSnapshots.push(payload);
        snapshotId += 1;
        return { id: snapshotId, userId: payload.userId };
      },
      async getBrokerId() {
        throw new Error("should_not_lookup_brokers_when_schedule_blocks_trading");
      },
      async getBrokerIdByCodes() {
        throw new Error("should_not_lookup_brokers_when_schedule_blocks_trading");
      },
      async closeOppositeCompletedTrades() {
        return 0;
      },
    };

    (service as any).tradingAccountService = {
      async resolveStrategyExecutionTargets() {
        tradingAccountLookups += 1;
        return {
          accounts: [{ userId: 10, id: 100 }],
          eligibleOwnedAccountIds: [100],
          masterAccountIds: [],
          followerAccountIds: [],
        };
      },
    };

    (service as any).tradeSignalService = {
      async createTradeSignal(payload: any[]) {
        createdSignals.push(...payload);
      },
    };

    (service as any).userDBService = {
      async getAdminStrategyTradeSchedule() {
        return {
          isEnabled: true,
          timezone: "Asia/Kolkata",
          windows: [
            {
              id: "evening_block",
              label: "Evening pause",
              daysOfWeek: [1, 2, 3, 4, 5],
              startTime: "17:00",
              endTime: "19:00",
              isEnabled: true,
            },
          ],
        };
      },
      async getEdgingStatus() {
        return { isEnabled: false, userId: "0" };
      },
    };

    const result = await service.createForPlan(200, {
      market: "FOREX",
      ticker: "EURUSD",
      exchange: "OANDA",
      interval: "15",
      barTime: new Date("2026-04-21T12:30:00.000Z"),
      alertTime: new Date("2026-04-21T12:30:00.000Z"),
      open: 1.1,
      close: 1.2,
      high: 1.3,
      low: 1.0,
      volume: 99,
      tradingStrength: 55,
      action: "BUY",
    });

    assert.equal(result.recipientCount, 0);
    assert.equal(result.snapshotCount, 1);
    assert.equal(result.signalCount, 0);
    assert.equal(result.adminStrategyTradeId, 7000);
    assert.equal(createdSnapshots.length, 1);
    assert.equal(createdSnapshots[0].adminStrategyTradeId, 7000);
    assert.equal(createdSnapshots[0].strategyId, 300);
    assert.equal(createdSnapshots[0].subscriptionId, 1);
    assert.equal(createdSignals.length, 0);
    assert.equal(tradingAccountLookups, 0);
  } finally {
    restoreDateNow();
    restoreCreateQueryRunner();
  }
});

test("AlertSnapshotService: create accepts subscriber webhook usage for strategy-managed plans and uses strategy-instance volume", async () => {
  const restoreCreateQueryRunner = patch(AppDataSource, "createQueryRunner", () => ({
    connect: async () => undefined,
    startTransaction: async () => undefined,
    commitTransaction: async () => undefined,
    rollbackTransaction: async () => undefined,
    release: async () => undefined,
    manager: {},
  }));

  try {
    const service = new AlertSnapshotService();
    let subscriberValidationCalls = 0;
    let brokerLookupCalls = 0;
    const createdSnapshots: any[] = [];
    const createdSignals: any[] = [];

    (service as any).isValidAssetType = async () => AssetType.FOREX;
    (service as any).userSubscriptionDbService = {
      async getActiveSubscriptionById() {
        return {
          id: 99,
          userId: 10,
          plan: {
            market: { code: "FOREX" },
            planStrategies: [
              {
                strategyId: 300,
                strategy: {
                  id: 300,
                  strategyCode: "STRAT_1",
                  name: "Strategy 1",
                  isActive: true,
                },
              },
            ],
          },
        };
      },
      async getStrategyInstancesBySubscriptionIds() {
        return [
          {
            id: 501,
            subscriptionId: 99,
            strategyId: 300,
            status: UserStrategyStatus.ACTIVE,
            volume: "0.13",
            strategy: {
              id: 300,
              strategyCode: "STRAT_1",
              name: "Strategy 1",
              isActive: true,
            },
          },
        ];
      },
    };
    (service as any).userSubscriptionService = {
      async subscriberPlanValidation() {
        subscriberValidationCalls += 1;
        return null;
      },
    };
    (service as any).alertSnapshotDB = {
      async create(payload: any) {
        createdSnapshots.push(payload);
        return { id: 1001 };
      },
      async getBrokerIdByCodes() {
        brokerLookupCalls += 1;
        return [9, 10];
      },
      async getBrokerId() {
        throw new Error("should_not_use_generic_broker_lookup");
      },
      async closeOppositeCompletedTrades() {
        return 0;
      },
    };
    (service as any).tradingAccountService = {
      async resolveStrategyExecutionTargets(userId: number, subscriptionId: number, brokerIds: number[]) {
        assert.equal(userId, 10);
        assert.equal(subscriptionId, 99);
        assert.deepEqual(brokerIds, [9, 10]);
        return {
          accounts: [{ userId, id: 7001 }],
          eligibleOwnedAccountIds: [7001],
          masterAccountIds: [],
          followerAccountIds: [],
        };
      },
    };
    (service as any).tradeSignalService = {
      async createTradeSignal(payload: any[]) {
        createdSignals.push(...payload);
      },
    };
    (service as any).userDBService = {
      async getEdgingStatus() {
        return { isEnabled: false, userId: "10" };
      },
    };

    const result = await service.create({
      userId: 10,
      subscriptionId: 99,
      planId: 200,
      tokenType: "webhook",
      market: "FOREX",
      ticker: "EURUSD",
      exchange: "OANDA",
      interval: "15",
      barTime: new Date("2026-04-01T00:00:00.000Z"),
      alertTime: new Date("2026-04-01T00:00:00.000Z"),
      open: 1.1,
      close: 1.2,
      high: 1.3,
      low: 1.0,
      volume: 5,
      action: "BUY",
      executionMode: "OPEN",
      entryRef: "entry-1",
      orderType: "MARKET",
      stopLossDistance: 10,
      trailingTakeProfitActivationDistance: 0.003,
      trailingTakeProfitDistance: 0.0015,
      breakEvenActivationDistance: 10,
      breakEvenOffsetDistance: 2,
      trailingStopLossDistance: 7,
    });

    assert.equal(subscriberValidationCalls, 0);
    assert.equal(brokerLookupCalls, 1);
    assert.equal(result.snapshotId, 1001);
    assert.equal(result.signalCount, 1);
    assert.equal(result.recipientCount, 1);
    assert.equal(createdSnapshots.length, 1);
    assert.equal(createdSnapshots[0].userId, 10);
    assert.equal(createdSignals.length, 1);
    assert.equal(createdSignals[0].userId, 10);
    assert.equal(createdSignals[0].tradingAccountId, 7001);
    assert.equal(createdSignals[0].volume, 0.13);
    assert.equal(createdSignals[0].entryRef, "entry-1");
    assert.equal(createdSignals[0].stopLossDistance, 10);
    assert.equal(createdSignals[0].trailingTakeProfitActivationDistance, 0.003);
    assert.equal(createdSignals[0].trailingTakeProfitDistance, 0.0015);
    assert.equal(createdSignals[0].breakEvenActivationDistance, 10);
    assert.equal(createdSignals[0].breakEvenOffsetDistance, 2);
    assert.equal(createdSignals[0].trailingStopLossDistance, 7);
  } finally {
    restoreCreateQueryRunner();
  }
});

test("AlertSnapshotService: create normalizes mapped legacy amount inputs into logical distances", async () => {
  const restoreCreateQueryRunner = patch(AppDataSource, "createQueryRunner", () => ({
    connect: async () => undefined,
    startTransaction: async () => undefined,
    commitTransaction: async () => undefined,
    rollbackTransaction: async () => undefined,
    release: async () => undefined,
    manager: {},
  }));

  try {
    const service = new AlertSnapshotService();
    const createdSnapshots: any[] = [];
    const createdSignals: any[] = [];

    (service as any).isValidAssetType = async () => AssetType.FOREX;
    (service as any).userSubscriptionService = {
      async subscriberPlanValidation() {
        return { plan: null };
      },
    };
    (service as any).alertSnapshotDB = {
      async create(payload: any) {
        createdSnapshots.push(payload);
        return { id: 2001 };
      },
      async getBrokerIdByCodes() {
        return [9];
      },
      async getBrokerId() {
        return [9];
      },
      async closeOppositeCompletedTrades() {
        return 0;
      },
    };
    (service as any).tradingAccountService = {
      async getAllCopyTradingAccounts() {
        return [{ userId: 10, id: 7001 }];
      },
    };
    (service as any).tradeSignalService = {
      async createTradeSignal(payload: any[]) {
        createdSignals.push(...payload);
      },
    };
    (service as any).userDBService = {
      async getEdgingStatus() {
        return { isEnabled: false, userId: "10" };
      },
    };

    const result = await service.create({
      userId: 10,
      market: "FOREX",
      ticker: "EURUSD",
      exchange: "OANDA",
      interval: "15",
      barTime: new Date("2026-04-01T00:00:00.000Z"),
      alertTime: new Date("2026-04-01T00:00:00.000Z"),
      open: 1.1,
      close: 1.2,
      high: 1.3,
      low: 1.0,
      volume: 5,
      action: "BUY",
      executionMode: "OPEN",
      entryRef: "entry-legacy-amount",
      orderType: "MARKET",
      stopLossAmount: 7,
      takeProfitAmount: 10,
      trailingStopLoss: true,
    } as any);

    assert.equal(result.snapshotId, 2001);
    assert.equal(createdSnapshots.length, 1);
    assert.equal(createdSnapshots[0].stopLossDistance, 7);
    assert.equal(createdSnapshots[0].takeProfitDistance, 10);
    assert.equal(createdSnapshots[0].stopLossAmount, null);
    assert.equal(createdSnapshots[0].takeProfitAmount, null);
    assert.equal(createdSignals.length, 1);
    assert.equal(createdSignals[0].stopLossDistance, 7);
    assert.equal(createdSignals[0].takeProfitDistance, 10);
    assert.equal(createdSignals[0].stopLossAmount, null);
    assert.equal(createdSignals[0].takeProfitAmount, null);
  } finally {
    restoreCreateQueryRunner();
  }
});

test("AlertSnapshotService: create rejects non-integer logical distance inputs", async () => {
  const restoreCreateQueryRunner = patch(AppDataSource, "createQueryRunner", () => ({
    connect: async () => undefined,
    startTransaction: async () => undefined,
    commitTransaction: async () => undefined,
    rollbackTransaction: async () => undefined,
    release: async () => undefined,
    manager: {},
  }));

  try {
    const service = new AlertSnapshotService();

    await assert.rejects(
      async () =>
        service.create({
          userId: 10,
          market: "FOREX",
          ticker: "EURUSD",
          exchange: "OANDA",
          interval: "15",
          barTime: new Date("2026-04-01T00:00:00.000Z"),
          alertTime: new Date("2026-04-01T00:00:00.000Z"),
          open: 1.1,
          close: 1.2,
          high: 1.3,
          low: 1.0,
          volume: 5,
          action: "BUY",
          executionMode: "OPEN",
          entryRef: "entry-2",
          stopLossDistance: 0.5,
        } as any),
      (error: any) => {
        assert.equal(error?.statusCode, 400);
        assert.equal(error?.message, "invalid_stopLossDistance");
        return true;
      },
    );
  } finally {
    restoreCreateQueryRunner();
  }
});

test("AlertSnapshotService: Indian managed OPEN routes to Zebu and rejects unsupported fields", async () => {
  const service = new AlertSnapshotService();

  const brokerCodes = (service as any).getExecutionBrokerCodes({
    market: "INDIAN",
    executionMode: "OPEN",
    entryRef: "nifty-managed-1",
    stopLossDistance: 70,
    takeProfitDistance: 170,
  });

  assert.deepEqual(brokerCodes, ["ZEBU"]);

  assert.throws(
    () =>
      (service as any).validateAndNormalizeExecutionFields({
        market: "INDIAN",
        ticker: "RELIANCE",
        executionMode: "OPEN",
        entryRef: "reliance-managed-1",
        stopLossAmount: 70,
      }),
    (error: any) => error?.message === "zebu_rejects_stop_loss_amount"
  );

  assert.throws(
    () =>
      (service as any).validateAndNormalizeExecutionFields({
        market: "INDIAN",
        ticker: "RELIANCE",
        executionMode: "OPEN",
        entryRef: "reliance-managed-2",
        trailingTakeProfitActivationDistance: 100,
        trailingTakeProfitDistance: 50,
      }),
    (error: any) => error?.message === "zebu_rejects_trailing_take_profit"
  );

  assert.throws(
    () =>
      (service as any).validateAndNormalizeExecutionFields({
        market: "INDIAN",
        ticker: "RELIANCE",
        executionMode: "OPEN",
        entryRef: "reliance-managed-3",
        orderType: "MARKET_RANGE",
      }),
    (error: any) => error?.message === "zebu_unsupported_order_type"
  );
});

test("AlertSnapshotService: createForPlan preserves follower fanout when an eligible master account exists", async () => {
  const createdSignals: any[] = [];
  let snapshotId = 3000;

  const restoreCreateQueryRunner = patch(AppDataSource, "createQueryRunner", () => ({
    connect: async () => undefined,
    startTransaction: async () => undefined,
    commitTransaction: async () => undefined,
    rollbackTransaction: async () => undefined,
    release: async () => undefined,
    manager: {},
  }));

  try {
    const service = new AlertSnapshotService();

    (service as any).subscriptionPlanService = {
      async getPlan() {
        return {
          id: 200,
          isActive: true,
          market: { code: "FOREX" },
          strategy: {
            id: 300,
            strategyCode: "STRAT_1",
            name: "Strategy 1",
            isActive: true,
          },
        };
      },
    };

    (service as any).userSubscriptionDbService = {
      async getActiveStrategySubscriptionsForPlan() {
        return [{ id: 1, userId: 10, executionEnabled: true, user: { isAdmin: false } }];
      },
      async getStrategyInstancesBySubscriptionIds() {
        return [
          {
            id: 501,
            subscriptionId: 1,
            strategyId: 300,
            status: UserStrategyStatus.ACTIVE,
            volume: "0.07",
            strategy: {
              id: 300,
              strategyCode: "STRAT_1",
              name: "Strategy 1",
              isActive: true,
            },
          },
        ];
      },
    };

    (service as any).alertSnapshotDB = {
      async createAdminStrategyTrade(payload: any) {
        return { id: 7000, ...payload };
      },
      async updateAdminStrategyTradeFanout() {
        return undefined;
      },
      async create(payload: any) {
        snapshotId += 1;
        return { id: snapshotId, userId: payload.userId };
      },
      async getBrokerId() {
        return [9];
      },
      async closeOppositeCompletedTrades() {
        return 0;
      },
    };

    (service as any).tradingAccountService = {
      async resolveStrategyExecutionTargets() {
        return {
          accounts: [
            { userId: 10, id: 7001 },
            { userId: 77, id: 8001 },
          ],
          eligibleOwnedAccountIds: [7001],
          masterAccountIds: [7001],
          followerAccountIds: [8001],
        };
      },
    };

    (service as any).tradeSignalService = {
      async createTradeSignal(payload: any[]) {
        createdSignals.push(...payload);
      },
    };

    (service as any).userDBService = {
      async getEdgingStatus() {
        return { isEnabled: false, userId: "0" };
      },
    };

    const result = await service.createForPlan(200, {
      market: "FOREX",
      ticker: "EURUSD",
      exchange: "OANDA",
      interval: "15",
      barTime: new Date("2026-04-01T00:00:00.000Z"),
      alertTime: new Date("2026-04-01T00:00:00.000Z"),
      open: 1.1,
      close: 1.2,
      high: 1.3,
      low: 1.0,
      volume: 99,
      tradingStrength: 55,
      action: "BUY",
    });

    assert.equal(result.recipientCount, 1);
    assert.equal(result.signalCount, 2);
    assert.equal(createdSignals.length, 2);
    assert.deepEqual(
      createdSignals.map((signal) => ({ userId: signal.userId, tradingAccountId: signal.tradingAccountId })),
      [
        { userId: 10, tradingAccountId: 7001 },
        { userId: 77, tradingAccountId: 8001 },
      ],
    );
  } finally {
    restoreCreateQueryRunner();
  }
});

test("AlertSnapshotService: createForPlan creates snapshots but skips signals when no eligible strategy execution accounts exist", async () => {
  const createdSignals: any[] = [];
  const createdSnapshots: any[] = [];

  const restoreCreateQueryRunner = patch(AppDataSource, "createQueryRunner", () => ({
    connect: async () => undefined,
    startTransaction: async () => undefined,
    commitTransaction: async () => undefined,
    rollbackTransaction: async () => undefined,
    release: async () => undefined,
    manager: {},
  }));

  try {
    const service = new AlertSnapshotService();

    (service as any).subscriptionPlanService = {
      async getPlan() {
        return {
          id: 200,
          isActive: true,
          market: { code: "FOREX" },
          strategy: {
            id: 300,
            strategyCode: "STRAT_1",
            name: "Strategy 1",
            isActive: true,
          },
        };
      },
    };

    (service as any).userSubscriptionDbService = {
      async getActiveStrategySubscriptionsForPlan() {
        return [{ id: 1, userId: 10, executionEnabled: true, user: { isAdmin: false } }];
      },
      async getStrategyInstancesBySubscriptionIds() {
        return [
          {
            id: 501,
            subscriptionId: 1,
            strategyId: 300,
            status: UserStrategyStatus.ACTIVE,
            volume: "0.07",
            strategy: {
              id: 300,
              strategyCode: "STRAT_1",
              name: "Strategy 1",
              isActive: true,
            },
          },
        ];
      },
    };

    (service as any).alertSnapshotDB = {
      async createAdminStrategyTrade(payload: any) {
        return { id: 7000, ...payload };
      },
      async updateAdminStrategyTradeFanout() {
        return undefined;
      },
      async create(payload: any) {
        createdSnapshots.push(payload);
        return { id: 4001, userId: payload.userId };
      },
      async getBrokerId() {
        return [9];
      },
      async closeOppositeCompletedTrades() {
        return 0;
      },
    };

    (service as any).tradingAccountService = {
      async resolveStrategyExecutionTargets() {
        return {
          accounts: [],
          eligibleOwnedAccountIds: [],
          masterAccountIds: [],
          followerAccountIds: [],
        };
      },
    };

    (service as any).tradeSignalService = {
      async createTradeSignal(payload: any[]) {
        createdSignals.push(...payload);
      },
    };

    const result = await service.createForPlan(200, {
      market: "FOREX",
      ticker: "EURUSD",
      exchange: "OANDA",
      interval: "15",
      barTime: new Date("2026-04-01T00:00:00.000Z"),
      alertTime: new Date("2026-04-01T00:00:00.000Z"),
      open: 1.1,
      close: 1.2,
      high: 1.3,
      low: 1.0,
      volume: 99,
      tradingStrength: 55,
      action: "BUY",
    });

    assert.equal(result.snapshotCount, 1);
    assert.equal(result.recipientCount, 0);
    assert.equal(result.signalCount, 0);
    assert.equal(createdSnapshots.length, 1);
    assert.equal(createdSignals.length, 0);
  } finally {
    restoreCreateQueryRunner();
  }
});
