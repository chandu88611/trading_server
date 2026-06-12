import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "user-subscription-route-test-secret";

const AppDataSource = require("../../db/data-source").default;
const { UserSubscriptionRouter } = require("../../app/userSubscription/routes/userSubscription.route");
const { UserSubscriptionService } = require("../../app/userSubscription/services/userSubscription");
const { signAccessToken, Roles } = require("../../middleware/auth");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

async function startSubscriptionApp() {
  const express = require("express");
  const app = express();

  app.use(express.json());
  app.use("/", new UserSubscriptionRouter().getRouter());

  const server = await new Promise<any>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind user subscription test server");
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

function createToken(userId: number, roles: string[]) {
  return signAccessToken({
    userId: String(userId),
    roles,
  });
}

test("UserSubscriptionRouter: admin callers cannot use self-subscribe routes", async () => {
  let subscribeCalled = false;

  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreSubscribe = patch(UserSubscriptionService.prototype, "subscribe", async () => {
    subscribeCalled = true;
    return { id: 1 };
  });

  let app: Awaited<ReturnType<typeof startSubscriptionApp>> | null = null;

  try {
    app = await startSubscriptionApp();
    const result = await requestJson(`${app.baseUrl}/subscription/subscribe`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${createToken(1, [Roles.ADMIN, Roles.USER])}`,
      },
      body: JSON.stringify({ planId: 5 }),
    });

    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { message: "admin_subscriptions_not_allowed" });
    assert.equal(subscribeCalled, false);
  } finally {
    restoreSubscribe();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("UserSubscriptionRouter: non-admin callers cannot use admin subscription routes", async () => {
  let adminGetAllCalled = false;

  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreAdminGetAll = patch(
    UserSubscriptionService.prototype,
    "getAllSubscriptions",
    async () => {
      adminGetAllCalled = true;
      return [];
    }
  );

  let app: Awaited<ReturnType<typeof startSubscriptionApp>> | null = null;

  try {
    app = await startSubscriptionApp();
    const result = await requestJson(`${app.baseUrl}/admin/subscription/all`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${createToken(7, [Roles.USER])}`,
      },
    });

    assert.equal(result.status, 403);
    assert.deepEqual(result.body, { message: "Forbidden" });
    assert.equal(adminGetAllCalled, false);
  } finally {
    restoreAdminGetAll();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("UserSubscriptionRouter: current supports market/start/count query contract", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let captured: any = null;
  const restoreCurrent = patch(
    UserSubscriptionService.prototype,
    "getCurrentSubscription",
    async (userId: number, start: number, count: number, searchParams: any) => {
      captured = { userId, start, count, searchParams };
      return { data: [], followers: [] };
    }
  );

  let app: Awaited<ReturnType<typeof startSubscriptionApp>> | null = null;

  try {
    app = await startSubscriptionApp();
    const result = await requestJson(
      `${app.baseUrl}/subscription/current?market=FOREX&start=5&count=10`,
      {
        headers: {
          authorization: `Bearer ${createToken(7, [Roles.USER])}`,
        },
      }
    );

    assert.equal(result.status, 200);
    assert.deepEqual(captured, {
      userId: 7,
      start: 5,
      count: 10,
      searchParams: { market: "FOREX" },
    });
    assert.deepEqual(result.body.data, { data: [], followers: [] });
    assert.deepEqual(result.body.subscription, { data: [], followers: [] });
  } finally {
    restoreCurrent();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("UserSubscriptionRouter: webhook settings save accepts plan/account/defaults", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let captured: any = null;
  const restoreSave = patch(
    UserSubscriptionService.prototype,
    "saveWebhookSettings",
    async (userId: number, payload: any) => {
      captured = { userId, payload };
      return { id: 9, isWebhookEnabled: payload.isWebhookEnabled, webhookToken: "token" };
    }
  );

  let app: Awaited<ReturnType<typeof startSubscriptionApp>> | null = null;

  try {
    app = await startSubscriptionApp();
    const body = {
      planId: 3,
      isWebhookEnabled: true,
      defaultTradingAccountId: 12,
      payloadDefaults: { action: "BUY" },
    };
    const result = await requestJson(`${app.baseUrl}/subscription/webhook-settings`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${createToken(7, [Roles.USER])}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.message, "webhook_settings_saved");
    assert.deepEqual(captured, {
      userId: 7,
      payload: {
        subscriptionId: null,
        planId: 3,
        isWebhookEnabled: true,
        defaultTradingAccountId: 12,
        payloadDefaults: { action: "BUY" },
      },
    });
  } finally {
    restoreSave();
    restoreGetRepository();
    if (app) await app.close();
  }
});
