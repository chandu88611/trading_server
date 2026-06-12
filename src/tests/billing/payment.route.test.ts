import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "payment-route-test-secret";

const AppDataSource = require("../../db/data-source").default;
const { PaymentRouter } = require("../../app/billing/routes/payment.route");
const { BillingDBService } = require("../../app/billing/services/billing.db");
const { signAccessToken, Roles } = require("../../middleware/auth");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

async function startBillingApp() {
  const express = require("express");
  const app = express();

  app.use(express.json());
  app.use("/billing", new PaymentRouter().getRouter());

  const server = await new Promise<any>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind billing test server");
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

test("PaymentRouter: admin callers cannot create subscription checkout", async () => {
  let checkoutCalled = false;

  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreCreateCheckout = patch(
    BillingDBService.prototype,
    "createRazorpayCheckout",
    async () => {
      checkoutCalled = true;
      return {};
    }
  );

  let app: Awaited<ReturnType<typeof startBillingApp>> | null = null;

  try {
    app = await startBillingApp();
    const result = await requestJson(`${app.baseUrl}/billing/subscription/checkout`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${createToken(1, [Roles.ADMIN, Roles.USER])}`,
      },
      body: JSON.stringify({ planId: 9 }),
    });

    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { message: "admin_subscriptions_not_allowed" });
    assert.equal(checkoutCalled, false);
  } finally {
    restoreCreateCheckout();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("PaymentRouter: GET /billing/wallet requires auth", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));

  let app: Awaited<ReturnType<typeof startBillingApp>> | null = null;

  try {
    app = await startBillingApp();
    const result = await requestJson(`${app.baseUrl}/billing/wallet`);

    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { message: "Unauthorized" });
  } finally {
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("PaymentRouter: GET /billing/wallet returns the authenticated user wallet summary", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let capturedUserId: number | null = null;
  const restoreGetWalletSummary = patch(
    BillingDBService.prototype,
    "getWalletSummary",
    async (userId: number) => {
      capturedUserId = userId;
      return {
        currency: "INR",
        totalEarned: 1200,
        pendingRewards: 200,
        withdrawableAmount: 800,
        lockedWithdrawalAmount: 100,
        totalWithdrawn: 100,
        minWithdrawalAmount: 500,
        holdDays: 7,
      };
    }
  );

  let app: Awaited<ReturnType<typeof startBillingApp>> | null = null;

  try {
    app = await startBillingApp();
    const result = await requestJson(`${app.baseUrl}/billing/wallet`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${createToken(42, [Roles.USER])}`,
      },
    });

    assert.equal(result.status, 200);
    assert.equal(capturedUserId, 42);
    assert.deepEqual(result.body, {
      message: "Wallet fetched successfully",
      data: {
        currency: "INR",
        totalEarned: 1200,
        pendingRewards: 200,
        withdrawableAmount: 800,
        lockedWithdrawalAmount: 100,
        totalWithdrawn: 100,
        minWithdrawalAmount: 500,
        holdDays: 7,
      },
    });
  } finally {
    restoreGetWalletSummary();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("PaymentRouter: POST /billing/withdrawals validates amount as a number", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let called = false;
  const restoreCreateWithdrawalRequest = patch(
    BillingDBService.prototype,
    "createWithdrawalRequest",
    async () => {
      called = true;
      return {};
    }
  );

  let app: Awaited<ReturnType<typeof startBillingApp>> | null = null;

  try {
    app = await startBillingApp();
    const result = await requestJson(`${app.baseUrl}/billing/withdrawals`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${createToken(99, [Roles.USER])}`,
      },
      body: JSON.stringify({ amount: "500" }),
    });

    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { message: "amount must be a number" });
    assert.equal(called, false);
  } finally {
    restoreCreateWithdrawalRequest();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("PaymentRouter: POST /billing/withdrawals creates a withdrawal request", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let capturedArgs: any[] | null = null;
  const restoreCreateWithdrawalRequest = patch(
    BillingDBService.prototype,
    "createWithdrawalRequest",
    async (...args: any[]) => {
      capturedArgs = args;
      return {
        id: 77,
        amountInr: 750,
        status: "requested",
        adminReviewNotes: null,
        failureCode: null,
        failureDescription: null,
        createdAt: new Date("2026-04-18T00:00:00.000Z"),
        updatedAt: new Date("2026-04-18T00:00:00.000Z"),
        approvedAt: null,
        rejectedAt: null,
        queuedAt: null,
        processedAt: null,
        failedAt: null,
        reversedAt: null,
      };
    }
  );

  let app: Awaited<ReturnType<typeof startBillingApp>> | null = null;

  try {
    app = await startBillingApp();
    const result = await requestJson(`${app.baseUrl}/billing/withdrawals`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${createToken(55, [Roles.USER])}`,
      },
      body: JSON.stringify({ amount: 750 }),
    });

    assert.equal(result.status, 201);
    assert.deepEqual(capturedArgs, [55, 750]);
    assert.equal(result.body.message, "Withdrawal requested");
    assert.equal(result.body.data.id, 77);
    assert.equal(result.body.data.status, "requested");
  } finally {
    restoreCreateWithdrawalRequest();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("PaymentRouter: GET /billing/admin/withdrawals requires admin access", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreListAdminWithdrawals = patch(
    BillingDBService.prototype,
    "listAdminWithdrawals",
    async () => []
  );

  let app: Awaited<ReturnType<typeof startBillingApp>> | null = null;

  try {
    app = await startBillingApp();
    const result = await requestJson(`${app.baseUrl}/billing/admin/withdrawals`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${createToken(5, [Roles.USER])}`,
      },
    });

    assert.equal(result.status, 403);
    assert.deepEqual(result.body, { message: "Forbidden" });
  } finally {
    restoreListAdminWithdrawals();
    restoreGetRepository();
    if (app) await app.close();
  }
});
