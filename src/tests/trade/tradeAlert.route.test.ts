import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "trade-alert-route-secret";

const AppDataSource = require("../../db/data-source").default;
const { TradeRouter } = require("../../app/trade/routes/trade.route");
const { TradeAlertService } = require("../../app/trade/services/tradeAlert.service");
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
    throw new Error("Failed to bind trade alert test server");
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

test("TradeRouter: subscriber can list trade alerts with unread filter", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let captured: any = null;
  const restoreList = patch(
    TradeAlertService.prototype,
    "listForUser",
    async (userId: number, query: any) => {
      captured = { userId, query };
      return {
        data: [{ id: 1, eventType: "trade_placed" }],
        pagination: { start: 3, count: 5, total: 1 },
        unreadCount: 1,
      };
    }
  );
  let app: Awaited<ReturnType<typeof startTradeApp>> | null = null;

  try {
    app = await startTradeApp();
    const result = await requestJson(
      `${app.baseUrl}/trade/alerts?start=3&count=5&unreadOnly=true`,
      {
        headers: {
          authorization: `Bearer ${createUserToken(77)}`,
        },
      }
    );

    assert.equal(result.status, 200);
    assert.deepEqual(captured, {
      userId: 77,
      query: {
        start: 3,
        count: 5,
        unreadOnly: true,
      },
    });
    assert.equal(result.body.unreadCount, 1);
  } finally {
    restoreList();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("TradeRouter: subscriber can mark one trade alert read", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let captured: any = null;
  const restoreMarkRead = patch(
    TradeAlertService.prototype,
    "markRead",
    async (userId: number, alertId: number) => {
      captured = { userId, alertId };
      return { id: alertId, isRead: true };
    }
  );
  let app: Awaited<ReturnType<typeof startTradeApp>> | null = null;

  try {
    app = await startTradeApp();
    const result = await requestJson(`${app.baseUrl}/trade/alerts/9/read`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${createUserToken(77)}`,
      },
    });

    assert.equal(result.status, 200);
    assert.deepEqual(captured, { userId: 77, alertId: 9 });
    assert.equal(result.body.message, "trade_alert_marked_read");
  } finally {
    restoreMarkRead();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("TradeRouter: subscriber can mark all trade alerts read", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let capturedUserId: number | null = null;
  const restoreMarkAllRead = patch(
    TradeAlertService.prototype,
    "markAllRead",
    async (userId: number) => {
      capturedUserId = userId;
      return { updatedCount: 4 };
    }
  );
  let app: Awaited<ReturnType<typeof startTradeApp>> | null = null;

  try {
    app = await startTradeApp();
    const result = await requestJson(`${app.baseUrl}/trade/alerts/read-all`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${createUserToken(77)}`,
      },
    });

    assert.equal(result.status, 200);
    assert.equal(capturedUserId, 77);
    assert.deepEqual(result.body, {
      message: "trade_alerts_marked_read",
      data: { updatedCount: 4 },
    });
  } finally {
    restoreMarkAllRead();
    restoreGetRepository();
    if (app) await app.close();
  }
});
