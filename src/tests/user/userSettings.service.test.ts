import test from "node:test";
import assert from "node:assert/strict";

const AppDataSource = require("../../db/data-source").default;
const { UserDBService } = require("../../app/user/services/user.db");
const { UserService } = require("../../app/user/services/user.service");
const { BillingDBService } = require("../../app/billing/services/billing.db");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

function createSettingsAccount(params: {
  id: number;
  userId: number;
  subscriptionId: number | null;
  accountId: string;
  accountLabel: string | null;
  isEnabled: boolean;
  isMaster: boolean;
  status: string;
  brokerId: number;
  brokerCode: string;
  brokerName: string;
  brokerMarketCategory: string;
  planId?: number | null;
  planName?: string | null;
  subscriptionStatus?: string | null;
}) {
  return {
    id: params.id,
    userId: params.userId,
    subscriptionId: params.subscriptionId,
    accountId: params.accountId,
    accountLabel: params.accountLabel,
    isEnabled: params.isEnabled,
    isMaster: params.isMaster,
    status: params.status,
    lastVerifiedAt: new Date("2026-04-11T00:00:00.000Z"),
    broker: {
      id: params.brokerId,
      code: params.brokerCode,
      name: params.brokerName,
      marketCategory: params.brokerMarketCategory,
      isActive: true,
    },
    subscription: params.subscriptionId
      ? {
          id: params.subscriptionId,
          planId: params.planId ?? null,
          statusV2: params.subscriptionStatus ?? null,
          plan: params.planId
            ? {
                id: params.planId,
                name: params.planName ?? null,
              }
            : null,
        }
      : null,
  };
}

test("UserService: getSettingsData returns grouped trade, copyTrade, edging, and account summaries", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreGetUserSettingsData = patch(
    UserDBService.prototype,
    "getUserSettingsData",
    async () => ({
      user: {
        id: 77,
        email: "settings@example.com",
        name: "Settings User",
        isEmailVerified: true,
        isActive: true,
        isAdmin: false,
        allowTrade: false,
        allowCopyTrade: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-12T00:00:00.000Z"),
        lastLoginAt: new Date("2026-04-13T00:00:00.000Z"),
      },
      edging: {
        id: "1",
        userId: "77",
        isEnabled: true,
        notes: "Paused for manual review",
        updatedAt: new Date("2026-04-14T00:00:00.000Z"),
      },
      riskLimits: {
        id: "11",
        userId: "77",
        isEnabled: true,
        dailyLossLimit: 2500,
        dailyProfitTarget: 4500,
        maxTradesPerDay: 8,
        cooldownAfterLossMins: 20,
        updatedAt: new Date("2026-04-14T10:00:00.000Z"),
      },
      accounts: [
        createSettingsAccount({
          id: 501,
          userId: 77,
          subscriptionId: 9001,
          accountId: "ACC-1",
          accountLabel: "Primary",
          isEnabled: false,
          isMaster: true,
          status: "verified",
          brokerId: 10,
          brokerCode: "CT",
          brokerName: "cTrader",
          brokerMarketCategory: "FOREX",
          planId: 301,
          planName: "Pro",
          subscriptionStatus: "active",
        }),
        createSettingsAccount({
          id: 502,
          userId: 77,
          subscriptionId: null,
          accountId: "ACC-2",
          accountLabel: "Backup",
          isEnabled: false,
          isMaster: false,
          status: "pending",
          brokerId: 11,
          brokerCode: "DHAN",
          brokerName: "Dhan",
          brokerMarketCategory: "INDIA",
        }),
      ],
    })
  );
  const restoreGetWalletSummary = patch(
    BillingDBService.prototype,
    "getWalletSummary",
    async () => ({
      currency: "INR",
      totalEarned: 1200,
      pendingRewards: 300,
      withdrawableAmount: 700,
      lockedWithdrawalAmount: 100,
      totalWithdrawn: 100,
      minWithdrawalAmount: 500,
      holdDays: 7,
    })
  );

  try {
    const service = new UserService();
    const result = await service.getSettingsData(77);

    assert.deepEqual(result.trade, { allowTrade: false });
    assert.deepEqual(result.copyTrade, { allowCopyTrade: true });
    assert.deepEqual(result.edging, {
      isEnabled: true,
      notes: "Paused for manual review",
      updatedAt: new Date("2026-04-14T00:00:00.000Z"),
    });
    assert.deepEqual(result.riskLimits, {
      isEnabled: true,
      dailyLossLimit: 2500,
      dailyProfitTarget: 4500,
      maxTradesPerDay: 8,
      cooldownAfterLossMins: 20,
      updatedAt: new Date("2026-04-14T10:00:00.000Z"),
    });
    assert.deepEqual(result.wallet, {
      currency: "INR",
      totalEarned: 1200,
      pendingRewards: 300,
      withdrawableAmount: 700,
      lockedWithdrawalAmount: 100,
      totalWithdrawn: 100,
      minWithdrawalAmount: 500,
      holdDays: 7,
    });
    assert.equal(result.accounts.length, 2);
    assert.deepEqual(result.accounts[0], {
      id: 501,
      accountId: "ACC-1",
      accountLabel: "Primary",
      isEnabled: false,
      isMaster: true,
      status: "verified",
      lastVerifiedAt: new Date("2026-04-11T00:00:00.000Z"),
      broker: {
        id: 10,
        code: "CT",
        name: "cTrader",
        marketCategory: "FOREX",
      },
      subscription: {
        id: 9001,
        planId: 301,
        planName: "Pro",
        status: "active",
      },
    });
    assert.equal(result.accounts[1].subscription, null);
  } finally {
    restoreGetWalletSummary();
    restoreGetUserSettingsData();
    restoreGetRepository();
  }
});

test("UserService: getSettingsData handles users with no accounts", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreGetUserSettingsData = patch(
    UserDBService.prototype,
    "getUserSettingsData",
    async () => ({
      user: {
        id: 88,
        email: "empty@example.com",
        name: null,
        isEmailVerified: true,
        isActive: true,
        isAdmin: false,
        allowTrade: true,
        allowCopyTrade: false,
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-12T00:00:00.000Z"),
        lastLoginAt: null,
      },
      edging: {
        id: "2",
        userId: "88",
        isEnabled: false,
        notes: null,
        updatedAt: new Date("2026-04-15T00:00:00.000Z"),
      },
      riskLimits: {
        id: "12",
        userId: "88",
        isEnabled: false,
        dailyLossLimit: null,
        dailyProfitTarget: null,
        maxTradesPerDay: null,
        cooldownAfterLossMins: null,
        updatedAt: new Date("2026-04-15T01:00:00.000Z"),
      },
      accounts: [],
    })
  );
  const restoreGetWalletSummary = patch(
    BillingDBService.prototype,
    "getWalletSummary",
    async () => ({
      currency: "INR",
      totalEarned: 0,
      pendingRewards: 0,
      withdrawableAmount: 0,
      lockedWithdrawalAmount: 0,
      totalWithdrawn: 0,
      minWithdrawalAmount: 500,
      holdDays: 7,
    })
  );

  try {
    const service = new UserService();
    const result = await service.getSettingsData(88);

    assert.deepEqual(result, {
      trade: {
        allowTrade: true,
      },
      copyTrade: {
        allowCopyTrade: false,
      },
      edging: {
        isEnabled: false,
        notes: null,
        updatedAt: new Date("2026-04-15T00:00:00.000Z"),
      },
      riskLimits: {
        isEnabled: false,
        dailyLossLimit: null,
        dailyProfitTarget: null,
        maxTradesPerDay: null,
        cooldownAfterLossMins: null,
        updatedAt: new Date("2026-04-15T01:00:00.000Z"),
      },
      wallet: {
        currency: "INR",
        totalEarned: 0,
        pendingRewards: 0,
        withdrawableAmount: 0,
        lockedWithdrawalAmount: 0,
        totalWithdrawn: 0,
        minWithdrawalAmount: 500,
        holdDays: 7,
      },
      accounts: [],
    });
  } finally {
    restoreGetWalletSummary();
    restoreGetUserSettingsData();
    restoreGetRepository();
  }
});

test("UserService: getAdminStrategyTradeSchedule maps the persisted admin schedule", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreGetAdminStrategyTradeSchedule = patch(
    UserDBService.prototype,
    "getAdminStrategyTradeSchedule",
    async () => ({
      id: 1,
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
      updatedAt: new Date("2026-04-21T10:00:00.000Z"),
    })
  );

  try {
    const service = new UserService();
    const result = await service.getAdminStrategyTradeSchedule();

    assert.deepEqual(result, {
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
      updatedAt: new Date("2026-04-21T10:00:00.000Z"),
    });
  } finally {
    restoreGetAdminStrategyTradeSchedule();
    restoreGetRepository();
  }
});

test("UserService: upsertAdminStrategyTradeSchedule normalizes and persists multiple windows", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let capturedPayload: any = null;

  const restoreUpsertAdminStrategyTradeSchedule = patch(
    UserDBService.prototype,
    "upsertAdminStrategyTradeSchedule",
    async (payload: any) => {
      capturedPayload = payload;
      return {
        id: 1,
        ...payload,
        updatedAt: new Date("2026-04-21T11:00:00.000Z"),
      };
    }
  );

  try {
    const service = new UserService();
    const result = await service.upsertAdminStrategyTradeSchedule({
      isEnabled: true,
      timezone: "Asia/Kolkata",
      windows: [
        {
          label: "US session pause",
          daysOfWeek: [5, 1, 3, 3],
          startTime: "17:00",
          endTime: "19:00",
          isEnabled: true,
        },
        {
          id: "overnight_block",
          label: null,
          daysOfWeek: [1, 2, 3, 4, 5],
          startTime: "23:30",
          endTime: "01:00",
          isEnabled: false,
        },
      ],
    });

    assert.deepEqual(capturedPayload, {
      isEnabled: true,
      timezone: "Asia/Kolkata",
      windows: [
        {
          id: "window_1",
          label: "US session pause",
          daysOfWeek: [1, 3, 5],
          startTime: "17:00",
          endTime: "19:00",
          isEnabled: true,
        },
        {
          id: "overnight_block",
          label: null,
          daysOfWeek: [1, 2, 3, 4, 5],
          startTime: "23:30",
          endTime: "01:00",
          isEnabled: false,
        },
      ],
    });
    assert.deepEqual(result, {
      isEnabled: true,
      timezone: "Asia/Kolkata",
      windows: capturedPayload.windows,
      updatedAt: new Date("2026-04-21T11:00:00.000Z"),
    });
  } finally {
    restoreUpsertAdminStrategyTradeSchedule();
    restoreGetRepository();
  }
});

test("UserService: upsertAdminStrategyTradeSchedule rejects invalid timezone before persisting", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let called = false;

  const restoreUpsertAdminStrategyTradeSchedule = patch(
    UserDBService.prototype,
    "upsertAdminStrategyTradeSchedule",
    async () => {
      called = true;
      throw new Error("should_not_be_called");
    }
  );

  try {
    const service = new UserService();

    await assert.rejects(
      () =>
        service.upsertAdminStrategyTradeSchedule({
          isEnabled: true,
          timezone: "Mars/Phobos",
          windows: [],
        }),
      (error: any) => {
        assert.equal(error?.message, "timezone must be a valid IANA timezone");
        return true;
      }
    );

    assert.equal(called, false);
  } finally {
    restoreUpsertAdminStrategyTradeSchedule();
    restoreGetRepository();
  }
});

test("UserService: upsertRiskLimits maps persisted values for API responses", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let capturedPayload: any = null;

  const restoreUpsertRiskLimits = patch(
    UserDBService.prototype,
    "upsertRiskLimits",
    async (_userId: number, payload: any) => {
      capturedPayload = payload;
      return {
        id: "15",
        userId: "99",
        isEnabled: true,
        dailyLossLimit: "1250.50",
        dailyProfitTarget: "3100.75",
        maxTradesPerDay: 4,
        cooldownAfterLossMins: 25,
        updatedAt: new Date("2026-04-15T08:00:00.000Z"),
      };
    }
  );

  try {
    const service = new UserService();
    const result = await service.upsertRiskLimits(99, {
      isEnabled: true,
      dailyLossLimit: 1250.5,
      dailyProfitTarget: 3100.75,
      maxTradesPerDay: 4,
      cooldownAfterLossMins: 25,
    });

    assert.deepEqual(capturedPayload, {
      isEnabled: true,
      dailyLossLimit: 1250.5,
      dailyProfitTarget: 3100.75,
      maxTradesPerDay: 4,
      cooldownAfterLossMins: 25,
    });
    assert.deepEqual(result, {
      isEnabled: true,
      dailyLossLimit: 1250.5,
      dailyProfitTarget: 3100.75,
      maxTradesPerDay: 4,
      cooldownAfterLossMins: 25,
      updatedAt: new Date("2026-04-15T08:00:00.000Z"),
    });
  } finally {
    restoreUpsertRiskLimits();
    restoreGetRepository();
  }
});
