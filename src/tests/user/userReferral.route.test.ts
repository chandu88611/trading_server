import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "user-referral-route-secret";

const AppDataSource = require("../../db/data-source").default;
const { UserRouter } = require("../../app/user/routes/user.route");
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
    throw new Error("Failed to bind user referral test server");
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

test("UserRouter: GET /user/referral requires auth", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));

  let app: Awaited<ReturnType<typeof startUserApp>> | null = null;

  try {
    app = await startUserApp();
    const result = await requestJson(`${app.baseUrl}/user/referral`);

    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { message: "Unauthorized" });
  } finally {
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("UserRouter: GET /user/referral returns masked 2-level referral tree for the auth user", async () => {
  let capturedUserId: number | null = null;
  let capturedIncludeFullEmails: boolean | null = null;

  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreGetReferralSummary = patch(
    UserService.prototype,
    "getReferralSummary",
    async (userId: number, includeFullEmails = false) => {
      capturedUserId = userId;
      capturedIncludeFullEmails = includeFullEmails;
      return {
        user: {
          id: userId,
          referralCode: "AB12CD34",
        },
        upline: {
          level1: null,
          level2: null,
        },
        counts: {
          level1: 1,
          level2: 1,
          total: 2,
        },
        downline: {
          level1: [
            {
              id: 91,
              name: "Level One",
              maskedEmail: "le***@example.com",
              createdAt: new Date("2026-02-01T00:00:00.000Z"),
            },
          ],
          level2: [
            {
              id: 92,
              name: "Level Two",
              maskedEmail: "lt***@example.com",
              createdAt: new Date("2026-02-02T00:00:00.000Z"),
            },
          ],
        },
      };
    }
  );

  let app: Awaited<ReturnType<typeof startUserApp>> | null = null;

  try {
    app = await startUserApp();
    const result = await requestJson(`${app.baseUrl}/user/referral`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${createToken(44, [Roles.USER])}`,
      },
    });

    assert.equal(result.status, 200);
    assert.equal(capturedUserId, 44);
    assert.equal(capturedIncludeFullEmails, false);
    assert.equal(result.body.message, "Referral summary fetched successfully");
    assert.equal(result.body.data.user.referralCode, "AB12CD34");
    assert.equal(result.body.data.downline.level1[0].maskedEmail, "le***@example.com");
    assert.equal("email" in result.body.data.downline.level1[0], false);
  } finally {
    restoreGetReferralSummary();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("UserRouter: GET /user/:userId/referral rejects non-admin callers", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let called = false;
  const restoreGetReferralSummary = patch(
    UserService.prototype,
    "getReferralSummary",
    async () => {
      called = true;
      return null;
    }
  );

  let app: Awaited<ReturnType<typeof startUserApp>> | null = null;

  try {
    app = await startUserApp();
    const result = await requestJson(`${app.baseUrl}/user/45/referral`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${createToken(9, [Roles.USER])}`,
      },
    });

    assert.equal(result.status, 403);
    assert.deepEqual(result.body, { message: "Forbidden" });
    assert.equal(called, false);
  } finally {
    restoreGetReferralSummary();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("UserRouter: GET /user/:userId/referral returns full-email referral tree for admins", async () => {
  let capturedUserId: number | null = null;
  let capturedIncludeFullEmails: boolean | null = null;

  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreGetReferralSummary = patch(
    UserService.prototype,
    "getReferralSummary",
    async (userId: number, includeFullEmails = false) => {
      capturedUserId = userId;
      capturedIncludeFullEmails = includeFullEmails;
      return {
        user: {
          id: userId,
          referralCode: "ROOT0001",
        },
        upline: {
          level1: {
            id: 12,
            name: "Parent User",
            email: "parent@example.com",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          },
          level2: null,
        },
        counts: {
          level1: 1,
          level2: 0,
          total: 1,
        },
        downline: {
          level1: [
            {
              id: 88,
              name: "Child User",
              email: "child@example.com",
              createdAt: new Date("2026-03-01T00:00:00.000Z"),
            },
          ],
          level2: [],
        },
      };
    }
  );

  let app: Awaited<ReturnType<typeof startUserApp>> | null = null;

  try {
    app = await startUserApp();
    const result = await requestJson(`${app.baseUrl}/user/45/referral`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${createToken(1, [Roles.ADMIN, Roles.USER])}`,
      },
    });

    assert.equal(result.status, 200);
    assert.equal(capturedUserId, 45);
    assert.equal(capturedIncludeFullEmails, true);
    assert.equal(result.body.data.downline.level1[0].email, "child@example.com");
  } finally {
    restoreGetReferralSummary();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("UserRouter: GET /user returns referral summary fields and preserves pagination/search params", async () => {
  let capturedParams: any = null;

  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreListUsers = patch(
    UserService.prototype,
    "listUsers",
    async (params: any) => {
      capturedParams = params;
      return {
        items: [
          {
            id: 5,
            email: "alpha@example.com",
            name: "Alpha",
            isEmailVerified: true,
            isActive: true,
            isAdmin: false,
            allowTrade: true,
            allowCopyTrade: true,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
            lastLoginAt: new Date("2026-01-03T00:00:00.000Z"),
            referralCode: "ALPHA001",
            referredByUserId: 2,
            level1ReferralCount: 3,
            level2ReferralCount: 4,
          },
        ],
        total: 1,
        page: params.page,
        limit: params.limit,
        totalPages: 1,
      };
    }
  );

  let app: Awaited<ReturnType<typeof startUserApp>> | null = null;

  try {
    app = await startUserApp();
    const result = await requestJson(
      `${app.baseUrl}/user?page=2&limit=5&search=alpha`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${createToken(1, [Roles.ADMIN, Roles.USER])}`,
        },
      }
    );

    assert.equal(result.status, 200);
    assert.deepEqual(capturedParams, {
      page: 2,
      limit: 5,
      search: "alpha",
    });
    assert.equal(result.body.data[0].referralCode, "ALPHA001");
    assert.equal(result.body.data[0].referredByUserId, 2);
    assert.equal(result.body.data[0].level1ReferralCount, 3);
    assert.equal(result.body.data[0].level2ReferralCount, 4);
    assert.deepEqual(result.body.pagination, {
      page: 2,
      limit: 5,
      totalItems: 1,
      totalPages: 1,
    });
  } finally {
    restoreListUsers();
    restoreGetRepository();
    if (app) await app.close();
  }
});
