import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "user-dashboard-route-secret";

const AppDataSource = require("../../db/data-source").default;
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
  const { UserRouter } = require("../../app/user/routes");
  const app = express();

  app.use(express.json());
  app.use("/user", new UserRouter().getRouter());

  const server = await new Promise<any>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind user test server");
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

test("UserRouter: GET /user/dashboard requires auth", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));

  let app: Awaited<ReturnType<typeof startUserApp>> | null = null;

  try {
    app = await startUserApp();
    const result = await requestJson(`${app.baseUrl}/user/dashboard`);

    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { message: "Unauthorized" });
  } finally {
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("UserRouter: GET /user/dashboard uses auth user and returns dashboard payload", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let capturedUserId: number | null = null;

  const restoreGetDashboardData = patch(
    UserService.prototype,
    "getDashboardData",
    async (userId: number) => {
      capturedUserId = userId;
      return {
        user: {
          id: userId,
          email: "dashboard@example.com",
          name: "Dashboard User",
          isEmailVerified: true,
          isActive: true,
          isAdmin: false,
          allowTrade: true,
          allowCopyTrade: true,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-02T00:00:00.000Z"),
          lastLoginAt: new Date("2026-01-03T00:00:00.000Z"),
        },
        stats: {
          trades: {
            active: 1,
            closed: 2,
            failed: 3,
            total: 6,
          },
        },
        plans: {
          active: [],
          past: [],
        },
        accounts: [],
      };
    }
  );

  let app: Awaited<ReturnType<typeof startUserApp>> | null = null;

  try {
    app = await startUserApp();
    const result = await requestJson(`${app.baseUrl}/user/dashboard`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${createUserToken(77)}`,
      },
    });

    assert.equal(result.status, 200);
    assert.equal(capturedUserId, 77);
    assert.equal(result.body.message, "Dashboard fetched successfully");
    assert.equal(result.body.data.user.id, 77);
    assert.deepEqual(result.body.data.stats.trades, {
      active: 1,
      closed: 2,
      failed: 3,
      total: 6,
    });
  } finally {
    restoreGetDashboardData();
    restoreGetRepository();
    if (app) await app.close();
  }
});
