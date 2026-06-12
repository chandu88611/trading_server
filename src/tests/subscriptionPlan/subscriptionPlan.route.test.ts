import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "subscription-plan-route-test-secret";

const AppDataSource = require("../../db/data-source").default;
const { SubscriptionPlanService } = require("../../app/subscriptionPlan/services/subscriptionPlan");
const { signAccessToken, Roles } = require("../../middleware/auth");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

async function startPlanApp() {
  const express = require("express");
  const { SubscriptionPlanRouter } = require("../../app/subscriptionPlan/routes/subscriptionPlan.route");
  const app = express();

  app.use(express.json());
  app.use("/admin/plans", new SubscriptionPlanRouter().getRouter());

  const server = await new Promise<any>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind subscription plan test server");
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

function publicWebhookOrigin(fallback: string) {
  const configured = String(process.env.APP_BASE_URL || "").trim();
  if (!configured) return fallback;

  try {
    return new URL(configured).origin;
  } catch {
    return fallback;
  }
}

test("SubscriptionPlanRouter: GET admin webhook token requires auth", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));

  let app: Awaited<ReturnType<typeof startPlanApp>> | null = null;

  try {
    app = await startPlanApp();
    const result = await requestJson(
      `${app.baseUrl}/admin/plans/subscription-plan/12/webhook-token`
    );

    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { message: "Unauthorized" });
  } finally {
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("SubscriptionPlanRouter: GET admin webhook token rejects non-admin callers", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let called = false;

  const restoreGetAdminWebhookToken = patch(
    SubscriptionPlanService.prototype,
    "getAdminWebhookToken",
    async () => {
      called = true;
      return "plan-admin-token";
    }
  );

  let app: Awaited<ReturnType<typeof startPlanApp>> | null = null;

  try {
    app = await startPlanApp();
    const result = await requestJson(
      `${app.baseUrl}/admin/plans/subscription-plan/12/webhook-token`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${createToken(77, [Roles.USER])}`,
        },
      }
    );

    assert.equal(result.status, 403);
    assert.deepEqual(result.body, { message: "Forbidden" });
    assert.equal(called, false);
  } finally {
    restoreGetAdminWebhookToken();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("SubscriptionPlanRouter: GET admin webhook token returns plan token for admins", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let capturedPlanId: number | null = null;

  const restoreGetAdminWebhookToken = patch(
    SubscriptionPlanService.prototype,
    "getAdminWebhookToken",
    async (planId: number) => {
      capturedPlanId = planId;
      return "plan-admin-token";
    }
  );

  let app: Awaited<ReturnType<typeof startPlanApp>> | null = null;

  try {
    app = await startPlanApp();
    const origin = publicWebhookOrigin(app.baseUrl);
    const result = await requestJson(
      `${app.baseUrl}/admin/plans/subscription-plan/45/webhook-token`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${createToken(1, [Roles.ADMIN, Roles.USER])}`,
        },
      }
    );

    assert.equal(result.status, 200);
    assert.equal(capturedPlanId, 45);
    assert.deepEqual(result.body, {
      message: "Fetched admin webhook token",
      data: {
        planId: 45,
        adminWebhookToken: "plan-admin-token",
        url: `${origin}/tradingview/alerts/strategy?token=plan-admin-token`,
      },
    });
  } finally {
    restoreGetAdminWebhookToken();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("SubscriptionPlanRouter: POST rotate admin webhook token returns token url for admins", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let capturedPlanId: number | null = null;

  const restoreRotateAdminWebhookToken = patch(
    SubscriptionPlanService.prototype,
    "rotateAdminWebhookToken",
    async (planId: number) => {
      capturedPlanId = planId;
      return "rotated-plan-admin-token";
    }
  );

  let app: Awaited<ReturnType<typeof startPlanApp>> | null = null;

  try {
    app = await startPlanApp();
    const origin = publicWebhookOrigin(app.baseUrl);
    const result = await requestJson(
      `${app.baseUrl}/admin/plans/subscription-plan/45/webhook-token/rotate`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${createToken(1, [Roles.ADMIN, Roles.USER])}`,
        },
      }
    );

    assert.equal(result.status, 200);
    assert.equal(capturedPlanId, 45);
    assert.deepEqual(result.body, {
      message: "Rotated admin webhook token",
      data: {
        planId: 45,
        adminWebhookToken: "rotated-plan-admin-token",
        url: `${origin}/tradingview/alerts/strategy?token=rotated-plan-admin-token`,
      },
    });
  } finally {
    restoreRotateAdminWebhookToken();
    restoreGetRepository();
    if (app) await app.close();
  }
});
