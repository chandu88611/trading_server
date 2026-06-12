import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "user-route-test-secret";

const AppDataSource = require("../../db/data-source").default;
const { UserRouter } = require("../../app/user/routes/user.route");
const { UserDBService } = require("../../app/user/services/user.db");
const { UserService } = require("../../app/user/services/user.service");
const { CrmLifecycleSyncService } = require("../../app/integrations/crm/services/crmLifecycleSync.service");
const { signAccessToken, Roles, getJwtSecret } = require("../../middleware/auth");
const emailVerificationService = require("../../app/user/services/email-verification.service");

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

function createToken(userId: number, roles: string[]) {
  return signAccessToken({
    userId: String(userId),
    roles,
  });
}

test("UserRouter: POST /user/register accepts referral code, optional isAdmin, and issues admin role token", async () => {
  let createdUserParams: any = null;
  let verificationEmailPayload: any = null;
  let syncedUserId: number | null = null;

  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreFindByEmail = patch(UserDBService.prototype, "findByEmail", async () => null);
  const restoreFindByReferralCode = patch(
    UserDBService.prototype,
    "findByReferralCode",
    async (code: string) => ({
      id: 55,
      referralCode: code,
    })
  );
  const restoreCountAdmins = patch(UserDBService.prototype, "countAdmins", async () => 0);
  const restoreCreateUser = patch(
    UserDBService.prototype,
    "createUser",
    async (params: any) => {
      createdUserParams = params;
      return {
        id: 101,
        email: params.email,
        name: params.name ?? null,
        isAdmin: params.isAdmin ?? false,
        isEmailVerified: params.isEmailVerified ?? false,
      };
    }
  );
  const restoreSetEmailVerificationToken = patch(
    UserDBService.prototype,
    "setEmailVerificationToken",
    async () => undefined
  );
  const restoreSaveRefreshToken = patch(
    UserDBService.prototype,
    "saveRefreshToken",
    async () => ({ id: 1, tokenHash: "hash", revoked: false })
  );
  const restoreSendUserVerificationEmail = patch(
    emailVerificationService,
    "sendUserVerificationEmail",
    async (email: string, token: string) => {
      verificationEmailPayload = { email, token };
    }
  );
  const restoreSyncUserRegistered = patch(
    CrmLifecycleSyncService.prototype,
    "syncUserRegistered",
    async (userId: number) => {
      syncedUserId = userId;
    }
  );

  let app: Awaited<ReturnType<typeof startUserApp>> | null = null;

  try {
    app = await startUserApp();
    const result = await requestJson(`${app.baseUrl}/user/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "ADMIN@EXAMPLE.COM",
        password: "StrongPass123",
        name: "Admin User",
        isAdmin: true,
        referralCode: "ref55",
      }),
    });

    assert.equal(result.status, 201);
    assert.equal(createdUserParams.email, "admin@example.com");
    assert.equal(createdUserParams.name, "Admin User");
    assert.equal(createdUserParams.isEmailVerified, false);
    assert.equal(createdUserParams.isAdmin, true);
    assert.equal(createdUserParams.referredByUserId, 55);
    assert.equal(typeof createdUserParams.passwordHash, "string");
    assert.ok(createdUserParams.passwordHash.length > 20);
    assert.match(createdUserParams.referralCode, /^[A-Z0-9]{8}$/);
    assert.deepEqual(result.body.user, {
      id: 101,
      email: "admin@example.com",
      isAdmin: true,
    });
    assert.deepEqual(verificationEmailPayload?.email, "admin@example.com");
    assert.equal(typeof verificationEmailPayload?.token, "string");
    assert.equal(syncedUserId, 101);

    const decodedAccess = jwt.verify(
      result.body.tokens.access,
      getJwtSecret()
    ) as any;
    assert.deepEqual(decodedAccess.roles, [Roles.ADMIN, Roles.USER]);
    assert.equal(decodedAccess.userId, 101);
    assert.equal(decodedAccess.type, "access");
  } finally {
    restoreSyncUserRegistered();
    restoreSendUserVerificationEmail();
    restoreSaveRefreshToken();
    restoreSetEmailVerificationToken();
    restoreCreateUser();
    restoreFindByReferralCode();
    restoreFindByEmail();
    restoreCountAdmins();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("UserRouter: POST /user/register supports provider signup with referral code and optional isAdmin", async () => {
  let createdUserParams: any = null;
  let providerCreatePayload: any = null;
  let syncedUserId: number | null = null;

  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreFindByEmail = patch(UserDBService.prototype, "findByEmail", async () => null);
  const restoreFindByReferralCode = patch(
    UserDBService.prototype,
    "findByReferralCode",
    async (code: string) => ({
      id: 87,
      referralCode: code,
    })
  );
  const restoreCountAdmins = patch(UserDBService.prototype, "countAdmins", async () => 0);
  const restoreCreateUser = patch(
    UserDBService.prototype,
    "createUser",
    async (params: any) => {
      createdUserParams = params;
      return {
        id: 202,
        email: params.email,
        name: params.name ?? null,
        isAdmin: params.isAdmin ?? false,
        isEmailVerified: params.isEmailVerified ?? false,
      };
    }
  );
  const restoreGetProvider = patch(UserDBService.prototype, "getProvider", async () => null);
  const restoreCreateAuthProvider = patch(
    UserDBService.prototype,
    "createAuthProvider",
    async (_user: any, provider: string, providerUserId: string, meta: any) => {
      providerCreatePayload = { provider, providerUserId, meta };
      return {
        id: 1,
        provider,
        providerUserId,
        providerMeta: meta,
      };
    }
  );
  const restoreSaveRefreshToken = patch(
    UserDBService.prototype,
    "saveRefreshToken",
    async () => ({ id: 1, tokenHash: "hash", revoked: false })
  );
  const restoreSyncUserRegistered = patch(
    CrmLifecycleSyncService.prototype,
    "syncUserRegistered",
    async (userId: number) => {
      syncedUserId = userId;
    }
  );

  let app: Awaited<ReturnType<typeof startUserApp>> | null = null;

  try {
    app = await startUserApp();
    const result = await requestJson(`${app.baseUrl}/user/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        provider: "google",
        providerUserId: "google-user-202",
        email: "provider-admin@example.com",
        name: "Provider Admin",
        isAdmin: true,
        referralCode: "invite87",
      }),
    });

    assert.equal(result.status, 201);
    assert.equal(createdUserParams.email, "provider-admin@example.com");
    assert.equal(createdUserParams.name, "Provider Admin");
    assert.equal(createdUserParams.isEmailVerified, true);
    assert.equal(createdUserParams.isAdmin, true);
    assert.equal(createdUserParams.referredByUserId, 87);
    assert.equal(typeof createdUserParams.passwordHash, "string");
    assert.ok(createdUserParams.passwordHash.length > 20);
    assert.match(createdUserParams.referralCode, /^[A-Z0-9]{8}$/);
    assert.deepEqual(providerCreatePayload, {
      provider: "google",
      providerUserId: "google-user-202",
      meta: {
        createdAt: providerCreatePayload.meta.createdAt,
      },
    });
    assert.ok(providerCreatePayload.meta.createdAt instanceof Date);
    assert.deepEqual(result.body.user, {
      id: 202,
      email: "provider-admin@example.com",
      isAdmin: true,
    });
    assert.equal(syncedUserId, 202);

    const decodedAccess = jwt.verify(
      result.body.tokens.access,
      getJwtSecret()
    ) as any;
    assert.deepEqual(decodedAccess.roles, [Roles.ADMIN, Roles.USER]);
    assert.equal(decodedAccess.userId, 202);
    assert.equal(decodedAccess.type, "access");
  } finally {
    restoreSyncUserRegistered();
    restoreSaveRefreshToken();
    restoreCreateAuthProvider();
    restoreGetProvider();
    restoreCreateUser();
    restoreFindByReferralCode();
    restoreFindByEmail();
    restoreCountAdmins();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("UserRouter: POST /user/register rejects invalid referral code", async () => {
  let createUserCalled = false;

  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreFindByEmail = patch(UserDBService.prototype, "findByEmail", async () => null);
  const restoreFindByReferralCode = patch(
    UserDBService.prototype,
    "findByReferralCode",
    async () => null
  );
  const restoreCountAdmins = patch(UserDBService.prototype, "countAdmins", async () => 0);
  const restoreCreateUser = patch(UserDBService.prototype, "createUser", async () => {
    createUserCalled = true;
    return null;
  });

  let app: Awaited<ReturnType<typeof startUserApp>> | null = null;

  try {
    app = await startUserApp();
    const result = await requestJson(`${app.baseUrl}/user/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "referral@example.com",
        password: "StrongPass123",
        referralCode: "missing01",
      }),
    });

    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { message: "invalid_referral_code" });
    assert.equal(createUserCalled, false);
  } finally {
    restoreCreateUser();
    restoreCountAdmins();
    restoreFindByReferralCode();
    restoreFindByEmail();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("UserRouter: POST /user/register rejects a second admin signup", async () => {
  let createUserCalled = false;

  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreFindByEmail = patch(UserDBService.prototype, "findByEmail", async () => null);
  const restoreCountAdmins = patch(UserDBService.prototype, "countAdmins", async () => 1);
  const restoreCreateUser = patch(UserDBService.prototype, "createUser", async () => {
    createUserCalled = true;
    return null;
  });

  let app: Awaited<ReturnType<typeof startUserApp>> | null = null;

  try {
    app = await startUserApp();
    const result = await requestJson(`${app.baseUrl}/user/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "second-admin@example.com",
        password: "StrongPass123",
        name: "Second Admin",
        isAdmin: true,
      }),
    });

    assert.equal(result.status, 409);
    assert.deepEqual(result.body, { message: "single_admin_only" });
    assert.equal(createUserCalled, false);
  } finally {
    restoreCreateUser();
    restoreCountAdmins();
    restoreFindByEmail();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("UserRouter: PATCH /user/:userId/admin rejects non-admin callers", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let called = false;
  const restoreUpdateAdminStatus = patch(
    UserService.prototype,
    "updateAdminStatus",
    async () => {
      called = true;
      return { id: 88, email: "user@example.com", isAdmin: true };
    }
  );

  let app: Awaited<ReturnType<typeof startUserApp>> | null = null;

  try {
    app = await startUserApp();
    const result = await requestJson(`${app.baseUrl}/user/88/admin`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${createToken(9, [Roles.USER])}`,
      },
      body: JSON.stringify({ isAdmin: true }),
    });

    assert.equal(result.status, 403);
    assert.deepEqual(result.body, { message: "Forbidden" });
    assert.equal(called, false);
  } finally {
    restoreUpdateAdminStatus();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("UserRouter: PATCH /user/:userId/admin updates admin status for admin callers", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let capturedUserId: number | null = null;
  let capturedIsAdmin: boolean | null = null;
  const restoreUpdateAdminStatus = patch(
    UserService.prototype,
    "updateAdminStatus",
    async (userId: number, isAdmin: boolean) => {
      capturedUserId = userId;
      capturedIsAdmin = isAdmin;
      return {
        id: userId,
        email: "promoted@example.com",
        isAdmin,
      };
    }
  );

  let app: Awaited<ReturnType<typeof startUserApp>> | null = null;

  try {
    app = await startUserApp();
    const result = await requestJson(`${app.baseUrl}/user/45/admin`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${createToken(1, [Roles.ADMIN, Roles.USER])}`,
      },
      body: JSON.stringify({ isAdmin: true }),
    });

    assert.equal(result.status, 200);
    assert.equal(capturedUserId, 45);
    assert.equal(capturedIsAdmin, true);
    assert.deepEqual(result.body, {
      message: "Admin status updated",
      data: {
        id: 45,
        email: "promoted@example.com",
        isAdmin: true,
      },
    });
  } finally {
    restoreUpdateAdminStatus();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("UserRouter: PATCH /user/:userId/admin rejects promotion when another admin exists", async () => {
  let updateCalled = false;

  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreFindById = patch(UserDBService.prototype, "findById", async (userId: number) => ({
    id: userId,
    email: "user@example.com",
    isAdmin: false,
  }));
  const restoreCountAdmins = patch(UserDBService.prototype, "countAdmins", async () => 1);
  const restoreUpdateAdminStatus = patch(
    UserDBService.prototype,
    "updateAdminStatus",
    async () => {
      updateCalled = true;
      return null;
    }
  );

  let app: Awaited<ReturnType<typeof startUserApp>> | null = null;

  try {
    app = await startUserApp();
    const result = await requestJson(`${app.baseUrl}/user/45/admin`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${createToken(1, [Roles.ADMIN, Roles.USER])}`,
      },
      body: JSON.stringify({ isAdmin: true }),
    });

    assert.equal(result.status, 409);
    assert.deepEqual(result.body, { message: "single_admin_only" });
    assert.equal(updateCalled, false);
  } finally {
    restoreUpdateAdminStatus();
    restoreCountAdmins();
    restoreFindById();
    restoreGetRepository();
    if (app) await app.close();
  }
});
