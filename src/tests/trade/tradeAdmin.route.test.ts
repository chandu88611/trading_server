import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "trade-admin-route-secret";

const AppDataSource = require("../../db/data-source").default;
const { TradeRouter } = require("../../app/trade/routes/trade.route");
const { TradeService } = require("../../app/trade/services/trade.service");
const { signAccessToken, Roles } = require("../../middleware/auth");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

async function startTradeApp() {
  const express = require("express");
  const app = express();

  app.use(express.json());
  app.use("/trade", new TradeRouter().getRouter());

  const server = await new Promise<any>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind trade admin test server");
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

test("TradeRouter: admin strategy trade routes reject non-admin callers", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let app: Awaited<ReturnType<typeof startTradeApp>> | null = null;

  try {
    app = await startTradeApp();
    const result = await requestJson(`${app.baseUrl}/trade/admin/strategy-trades`, {
      headers: {
        authorization: `Bearer ${createUserToken(77)}`,
      },
    });

    assert.equal(result.status, 403);
    assert.deepEqual(result.body, { message: "Forbidden" });
  } finally {
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("TradeRouter: admin can list strategy trades with filters", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let capturedQuery: any = null;
  const restoreList = patch(
    TradeService.prototype,
    "listAdminStrategyTrades",
    async (query: any) => {
      capturedQuery = query;
      return {
        data: [{ id: 900, strategyId: 300, planId: 200, status: "fanned_out" }],
        pagination: { start: 5, count: 10, total: 1 },
      };
    }
  );
  let app: Awaited<ReturnType<typeof startTradeApp>> | null = null;

  try {
    app = await startTradeApp();
    const result = await requestJson(
      `${app.baseUrl}/trade/admin/strategy-trades?strategyId=300&planId=200&status=fanned_out&start=5&count=10`,
      {
        headers: {
          authorization: `Bearer ${createAdminToken(1)}`,
        },
      }
    );

    assert.equal(result.status, 200);
    assert.deepEqual(capturedQuery, {
      strategyId: 300,
      planId: 200,
      status: "fanned_out",
      from: undefined,
      to: undefined,
      start: 5,
      count: 10,
    });
    assert.equal(result.body.data[0].id, 900);
  } finally {
    restoreList();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("TradeRouter: admin can fetch one strategy trade detail", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let capturedId: number | null = null;
  const restoreGet = patch(
    TradeService.prototype,
    "getAdminStrategyTrade",
    async (adminStrategyTradeId: number) => {
      capturedId = adminStrategyTradeId;
      return {
        adminStrategyTrade: { id: adminStrategyTradeId, strategyId: 300 },
        userTrades: [{ id: 12, userId: 44, status: "completed" }],
      };
    }
  );
  let app: Awaited<ReturnType<typeof startTradeApp>> | null = null;

  try {
    app = await startTradeApp();
    const result = await requestJson(
      `${app.baseUrl}/trade/admin/strategy-trades/900`,
      {
        headers: {
          authorization: `Bearer ${createAdminToken(1)}`,
        },
      }
    );

    assert.equal(result.status, 200);
    assert.equal(capturedId, 900);
    assert.equal(result.body.adminStrategyTrade.id, 900);
    assert.equal(result.body.userTrades[0].status, "completed");
  } finally {
    restoreGet();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("TradeRouter: admin can queue close for one strategy parent trade", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let capturedId: number | null = null;
  const restoreClose = patch(
    TradeService.prototype,
    "closeAdminStrategyTrade",
    async (adminStrategyTradeId: number) => {
      capturedId = adminStrategyTradeId;
      return {
        adminStrategyTradeId,
        queuedCloseCount: 2,
        skippedCount: 1,
        signalIds: [11, 12],
      };
    }
  );
  let app: Awaited<ReturnType<typeof startTradeApp>> | null = null;

  try {
    app = await startTradeApp();
    const result = await requestJson(
      `${app.baseUrl}/trade/admin/strategy-trades/900/close`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${createAdminToken(1)}`,
        },
      }
    );

    assert.equal(result.status, 200);
    assert.equal(capturedId, 900);
    assert.deepEqual(result.body, {
      adminStrategyTradeId: 900,
      queuedCloseCount: 2,
      skippedCount: 1,
      signalIds: [11, 12],
    });
  } finally {
    restoreClose();
    restoreGetRepository();
    if (app) await app.close();
  }
});
