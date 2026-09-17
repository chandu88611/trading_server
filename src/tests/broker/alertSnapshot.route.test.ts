import test from "node:test";
import assert from "node:assert/strict";
import { requestJson, startInMemoryApp } from "../helpers/inMemoryExpress";

const AppDataSource = require("../../db/data-source").default;
const { AlertSnapshotService } = require("../../app/broker/brokerAlerts/services/alertSnapshot.service");
const { signWebhookToken } = require("../../middleware/auth");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

async function startAlertApp() {
  const express = require("express");
  const router = require("../../app/broker/brokerAlerts/routes/alertSnapshot.route").default;
  const app = express();

  app.use(express.json());
  app.use("/tradingview/alerts", router);

  return startInMemoryApp(app, "alert-route-test");
}

test("AlertSnapshotRouter: POST /tradingview/alerts/strategy requires a plan webhook token", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({
    createQueryBuilder() {
      return {
        leftJoinAndSelect() {
          return this;
        },
        where() {
          return this;
        },
        andWhere() {
          return this;
        },
        async getOne() {
          return null;
        },
      };
    },
  }));

  let app: Awaited<ReturnType<typeof startAlertApp>> | null = null;

  try {
    app = await startAlertApp();
    const result = await requestJson(`${app.baseUrl}/tradingview/alerts/strategy`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        market: "FOREX",
        ticker: "EURUSD",
        exchange: "OANDA",
        action: "BUY",
      }),
    });

    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { message: "Plan webhook token missing" });
  } finally {
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("AlertSnapshotRouter: POST /tradingview/alerts/strategy resolves plan from token and calls createForPlan", async () => {
  let capturedPlanId: number | null = null;
  let capturedPayload: any = null;

  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({
    createQueryBuilder() {
      return {
        leftJoinAndSelect() {
          return this;
        },
        where() {
          return this;
        },
        andWhere() {
          return this;
        },
        async getOne() {
          return {
            plan: {
              id: 300,
              isActive: true,
            },
          };
        },
      };
    },
  }));

  const restoreCreateForPlan = patch(
    AlertSnapshotService.prototype,
    "createForPlan",
    async (planId: number, payload: any) => {
      capturedPlanId = planId;
      capturedPayload = payload;
      return {
        planId,
        strategyId: 444,
        recipientCount: 2,
        snapshotCount: 2,
        signalCount: 3,
      };
    }
  );

  let app: Awaited<ReturnType<typeof startAlertApp>> | null = null;

  try {
    app = await startAlertApp();
    const body = {
      market: "FOREX",
      ticker: "EURUSD",
      exchange: "OANDA",
      interval: "15",
      action: "BUY",
      close: 1.11,
      alertTime: "2026-04-01T00:00:00.000Z",
      executionMode: "OPEN",
      entryRef: "route-entry-1",
      orderType: "MARKET",
      stopLossDistance: 0.002,
      trailingStopLoss: true,
      trailingTakeProfitActivationDistance: 0.003,
      trailingTakeProfitDistance: 0.0015,
    };

    const result = await requestJson(`${app.baseUrl}/tradingview/alerts/strategy`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-token": "plan-secret-token",
      },
      body: JSON.stringify(body),
    });

    assert.equal(result.status, 201);
    assert.equal(capturedPlanId, 300);
    assert.deepEqual(capturedPayload, body);
    assert.deepEqual(result.body, {
      message: "created",
      data: {
        planId: 300,
        strategyId: 444,
        recipientCount: 2,
        snapshotCount: 2,
        signalCount: 3,
      },
    });
  } finally {
    restoreCreateForPlan();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("AlertSnapshotRouter: POST /tradingview/alerts accepts a subscriber webhook token", async () => {
  let capturedPayload: any = null;

  const restoreCreate = patch(
    AlertSnapshotService.prototype,
    "create",
    async (payload: any) => {
      capturedPayload = payload;
      return {
        snapshotId: 901,
        signalCount: 1,
        recipientCount: 1,
      };
    }
  );

  let app: Awaited<ReturnType<typeof startAlertApp>> | null = null;

  try {
    app = await startAlertApp();
    const token = signWebhookToken(
      {
        userId: 77,
        subscriptionId: 55,
        planId: 200,
      },
      new Date("2026-12-01T00:00:00.000Z")
    );

    const body = {
      market: "FOREX",
      ticker: "EURUSD",
      exchange: "OANDA",
      interval: "15",
      action: "BUY",
      close: 1.11,
      alertTime: "2026-04-01T00:00:00.000Z",
    };

    const result = await requestJson(
      `${app.baseUrl}/tradingview/alerts?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    assert.equal(result.status, 200);
    assert.deepEqual(capturedPayload, {
      ...body,
      userId: 77,
      subscriptionId: 55,
      planId: 200,
      tokenType: "webhook",
    });
    assert.deepEqual(result.body, {
      message: "created",
      data: {
        snapshotId: 901,
        signalCount: 1,
        recipientCount: 1,
      },
    });
  } finally {
    restoreCreate();
    if (app) await app.close();
  }
});
