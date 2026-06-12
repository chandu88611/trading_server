import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "user-settings-route-secret";

const AppDataSource = require("../../db/data-source").default;
const { UserRouter } = require("../../app/user/routes");
const { UserService } = require("../../app/user/services/user.service");
const { signAccessToken, Roles } = require("../../middleware/auth");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

async function startUserApp() {
  const express = require("express");
  const app = express();

  app.use(express.json());
  app.use("/user", new UserRouter().getRouter());

  const server = await new Promise<any>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind user settings test server");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((error?: Error | null) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();

  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

function createUserToken(userId = 42) {
  return signAccessToken({
    userId: String(userId),
    roles: [Roles.USER],
  });
}

function createAdminToken(userId = 1) {
  return signAccessToken({
    userId: String(userId),
    roles: [Roles.ADMIN, Roles.USER],
  });
}

test("UserRouter: GET /user/settings requires auth", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));

  let app: Awaited<ReturnType<typeof startUserApp>> | null = null;

  try {
    app = await startUserApp();
    const result = await requestJson(`${app.baseUrl}/user/settings`);

    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { message: "Unauthorized" });
  } finally {
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("UserRouter: GET /user/settings returns grouped settings payload for the auth user", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let capturedUserId: number | null = null;

  const restoreGetSettingsData = patch(
    UserService.prototype,
    "getSettingsData",
    async (userId: number) => {
      capturedUserId = userId;
      return {
        trade: {
          allowTrade: false,
        },
        copyTrade: {
          allowCopyTrade: true,
        },
        edging: {
          isEnabled: true,
          notes: "Managed by ops",
          updatedAt: new Date("2026-04-10T12:00:00.000Z"),
        },
        riskLimits: {
          isEnabled: true,
          dailyLossLimit: 5000,
          dailyProfitTarget: 8000,
          maxTradesPerDay: 6,
          cooldownAfterLossMins: 45,
          updatedAt: new Date("2026-04-10T12:05:00.000Z"),
        },
        wallet: {
          currency: "INR",
          totalEarned: 1200,
          pendingRewards: 300,
          withdrawableAmount: 700,
          lockedWithdrawalAmount: 100,
          totalWithdrawn: 100,
          minWithdrawalAmount: 500,
          holdDays: 7,
        },
        accounts: [
          {
            id: 501,
            accountId: "ACC-501",
            accountLabel: "Primary",
            isEnabled: false,
            isMaster: true,
            status: "verified",
            lastVerifiedAt: new Date("2026-04-09T00:00:00.000Z"),
            broker: {
              id: 9,
              code: "CT",
              name: "cTrader",
              marketCategory: "FOREX",
            },
            subscription: {
              id: 7001,
              planId: 301,
              planName: "Pro",
              status: "active",
            },
          },
        ],
      };
    }
  );

  let app: Awaited<ReturnType<typeof startUserApp>> | null = null;

  try {
    app = await startUserApp();
    const result = await requestJson(`${app.baseUrl}/user/settings`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${createUserToken(77)}`,
      },
    });

    assert.equal(result.status, 200);
    assert.equal(capturedUserId, 77);
    assert.equal(result.body.message, "Settings fetched successfully");
    assert.deepEqual(result.body.data.trade, { allowTrade: false });
    assert.deepEqual(result.body.data.copyTrade, { allowCopyTrade: true });
    assert.equal(result.body.data.edging.notes, "Managed by ops");
    assert.deepEqual(result.body.data.riskLimits, {
      isEnabled: true,
      dailyLossLimit: 5000,
      dailyProfitTarget: 8000,
      maxTradesPerDay: 6,
      cooldownAfterLossMins: 45,
      updatedAt: "2026-04-10T12:05:00.000Z",
    });
    assert.deepEqual(result.body.data.wallet, {
      currency: "INR",
      totalEarned: 1200,
      pendingRewards: 300,
      withdrawableAmount: 700,
      lockedWithdrawalAmount: 100,
      totalWithdrawn: 100,
      minWithdrawalAmount: 500,
      holdDays: 7,
    });
    assert.equal(result.body.data.accounts.length, 1);
    assert.deepEqual(result.body.data.accounts[0].broker, {
      id: 9,
      code: "CT",
      name: "cTrader",
      marketCategory: "FOREX",
    });
    assert.deepEqual(result.body.data.accounts[0].subscription, {
      id: 7001,
      planId: 301,
      planName: "Pro",
      status: "active",
    });
  } finally {
    restoreGetSettingsData();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("UserRouter: GET /user/admin/strategy-trade-schedule rejects non-admin callers", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));

  let app: Awaited<ReturnType<typeof startUserApp>> | null = null;

  try {
    app = await startUserApp();
    const result = await requestJson(
      `${app.baseUrl}/user/admin/strategy-trade-schedule`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${createUserToken(55)}`,
        },
      }
    );

    assert.equal(result.status, 403);
    assert.deepEqual(result.body, { message: "Forbidden" });
  } finally {
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("UserRouter: GET /user/admin/strategy-trade-schedule returns the admin schedule", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let called = false;

  const restoreGetAdminStrategyTradeSchedule = patch(
    UserService.prototype,
    "getAdminStrategyTradeSchedule",
    async () => {
      called = true;
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
        updatedAt: new Date("2026-04-21T10:00:00.000Z"),
      };
    }
  );

  let app: Awaited<ReturnType<typeof startUserApp>> | null = null;

  try {
    app = await startUserApp();
    const result = await requestJson(
      `${app.baseUrl}/user/admin/strategy-trade-schedule`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${createAdminToken(1)}`,
        },
      }
    );

    assert.equal(result.status, 200);
    assert.equal(called, true);
    assert.deepEqual(result.body, {
      message: "Admin strategy trade schedule fetched",
      data: {
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
        updatedAt: "2026-04-21T10:00:00.000Z",
      },
    });
  } finally {
    restoreGetAdminStrategyTradeSchedule();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("UserRouter: PUT /user/admin/strategy-trade-schedule validates timezone and windows payload", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));

  let app: Awaited<ReturnType<typeof startUserApp>> | null = null;

  try {
    app = await startUserApp();
    const result = await requestJson(
      `${app.baseUrl}/user/admin/strategy-trade-schedule`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${createAdminToken(1)}`,
        },
        body: JSON.stringify({
          isEnabled: true,
          timezone: "Bad/Timezone",
          windows: [],
        }),
      }
    );

    assert.equal(result.status, 400);
    assert.deepEqual(result.body, {
      message: "timezone must be a valid IANA timezone",
    });
  } finally {
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("UserRouter: PUT /user/admin/strategy-trade-schedule updates the admin schedule", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let capturedPayload: any = null;

  const restoreUpsertAdminStrategyTradeSchedule = patch(
    UserService.prototype,
    "upsertAdminStrategyTradeSchedule",
    async (payload: any) => {
      capturedPayload = payload;
      return {
        isEnabled: true,
        timezone: "Asia/Kolkata",
        windows: [
          {
            id: "window_1",
            label: "Evening pause",
            daysOfWeek: [1, 2, 3, 4, 5],
            startTime: "17:00",
            endTime: "19:00",
            isEnabled: true,
          },
          {
            id: "overnight",
            label: null,
            daysOfWeek: [1, 2, 3, 4, 5],
            startTime: "23:00",
            endTime: "01:30",
            isEnabled: true,
          },
        ],
        updatedAt: new Date("2026-04-21T11:30:00.000Z"),
      };
    }
  );

  let app: Awaited<ReturnType<typeof startUserApp>> | null = null;

  try {
    app = await startUserApp();
    const body = {
      isEnabled: true,
      timezone: "Asia/Kolkata",
      windows: [
        {
          label: "Evening pause",
          daysOfWeek: [1, 2, 3, 4, 5],
          startTime: "17:00",
          endTime: "19:00",
          isEnabled: true,
        },
        {
          id: "overnight",
          label: null,
          daysOfWeek: [1, 2, 3, 4, 5],
          startTime: "23:00",
          endTime: "01:30",
          isEnabled: true,
        },
      ],
    };

    const result = await requestJson(
      `${app.baseUrl}/user/admin/strategy-trade-schedule`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${createAdminToken(1)}`,
        },
        body: JSON.stringify(body),
      }
    );

    assert.equal(result.status, 200);
    assert.deepEqual(capturedPayload, body);
    assert.deepEqual(result.body, {
      message: "Admin strategy trade schedule updated",
      data: {
        isEnabled: true,
        timezone: "Asia/Kolkata",
        windows: [
          {
            id: "window_1",
            label: "Evening pause",
            daysOfWeek: [1, 2, 3, 4, 5],
            startTime: "17:00",
            endTime: "19:00",
            isEnabled: true,
          },
          {
            id: "overnight",
            label: null,
            daysOfWeek: [1, 2, 3, 4, 5],
            startTime: "23:00",
            endTime: "01:30",
            isEnabled: true,
          },
        ],
        updatedAt: "2026-04-21T11:30:00.000Z",
      },
    });
  } finally {
    restoreUpsertAdminStrategyTradeSchedule();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("UserRouter: PUT /user/risk-limits validates numeric fields", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let called = false;

  const restoreUpdateRiskLimits = patch(
    UserService.prototype,
    "upsertRiskLimits",
    async () => {
      called = true;
      return {
        isEnabled: true,
        dailyLossLimit: 500,
        dailyProfitTarget: 700,
        maxTradesPerDay: 3,
        cooldownAfterLossMins: 15,
        updatedAt: new Date("2026-04-15T00:00:00.000Z"),
      };
    }
  );

  let app: Awaited<ReturnType<typeof startUserApp>> | null = null;

  try {
    app = await startUserApp();
    const result = await requestJson(`${app.baseUrl}/user/risk-limits`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${createUserToken(42)}`,
      },
      body: JSON.stringify({
        isEnabled: true,
        maxTradesPerDay: 2.5,
      }),
    });

    assert.equal(result.status, 400);
    assert.deepEqual(result.body, {
      message: "maxTradesPerDay must be null or a non-negative integer",
    });
    assert.equal(called, false);
  } finally {
    restoreUpdateRiskLimits();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("UserRouter: PUT /user/risk-limits updates risk settings", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let capturedUserId: number | null = null;
  let capturedPayload: any = null;

  const restoreUpdateRiskLimits = patch(
    UserService.prototype,
    "upsertRiskLimits",
    async (userId: number, payload: any) => {
      capturedUserId = userId;
      capturedPayload = payload;
      return {
        isEnabled: true,
        dailyLossLimit: 1000,
        dailyProfitTarget: 1500,
        maxTradesPerDay: 5,
        cooldownAfterLossMins: 30,
        updatedAt: new Date("2026-04-15T10:00:00.000Z"),
      };
    }
  );

  let app: Awaited<ReturnType<typeof startUserApp>> | null = null;

  try {
    app = await startUserApp();
    const result = await requestJson(`${app.baseUrl}/user/risk-limits`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${createUserToken(91)}`,
      },
      body: JSON.stringify({
        isEnabled: true,
        dailyLossLimit: 1000,
        dailyProfitTarget: 1500,
        maxTradesPerDay: 5,
        cooldownAfterLossMins: 30,
      }),
    });

    assert.equal(result.status, 200);
    assert.equal(capturedUserId, 91);
    assert.deepEqual(capturedPayload, {
      isEnabled: true,
      dailyLossLimit: 1000,
      dailyProfitTarget: 1500,
      maxTradesPerDay: 5,
      cooldownAfterLossMins: 30,
    });
    assert.deepEqual(result.body, {
      message: "Risk limits updated",
      data: {
        isEnabled: true,
        dailyLossLimit: 1000,
        dailyProfitTarget: 1500,
        maxTradesPerDay: 5,
        cooldownAfterLossMins: 30,
        updatedAt: "2026-04-15T10:00:00.000Z",
      },
    });
  } finally {
    restoreUpdateRiskLimits();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("UserRouter: PUT /user/trade-status validates allowTrade as a boolean", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let called = false;

  const restoreUpdateTradeStatus = patch(
    UserService.prototype,
    "updateTradeStatus",
    async () => {
      called = true;
      return {
        id: 42,
        allowTrade: false,
      };
    }
  );

  let app: Awaited<ReturnType<typeof startUserApp>> | null = null;

  try {
    app = await startUserApp();
    const result = await requestJson(`${app.baseUrl}/user/trade-status`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${createUserToken(42)}`,
      },
      body: JSON.stringify({ allowTrade: "false" }),
    });

    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { message: "allowTrade must be a boolean" });
    assert.equal(called, false);
  } finally {
    restoreUpdateTradeStatus();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("UserRouter: PUT /user/trade-status keeps the minimal response shape", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let capturedUserId: number | null = null;
  let capturedAllowTrade: boolean | null = null;

  const restoreUpdateTradeStatus = patch(
    UserService.prototype,
    "updateTradeStatus",
    async (userId: number, allowTrade: boolean) => {
      capturedUserId = userId;
      capturedAllowTrade = allowTrade;
      return {
        id: userId,
        allowTrade,
      };
    }
  );

  let app: Awaited<ReturnType<typeof startUserApp>> | null = null;

  try {
    app = await startUserApp();
    const result = await requestJson(`${app.baseUrl}/user/trade-status`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${createUserToken(91)}`,
      },
      body: JSON.stringify({ allowTrade: false }),
    });

    assert.equal(result.status, 200);
    assert.equal(capturedUserId, 91);
    assert.equal(capturedAllowTrade, false);
    assert.deepEqual(result.body, {
      message: "Trade status updated",
      data: {
        id: 91,
        allowTrade: false,
      },
    });
  } finally {
    restoreUpdateTradeStatus();
    restoreGetRepository();
    if (app) await app.close();
  }
});
