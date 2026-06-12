import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import https from "https";

process.env.JWT_SECRET = process.env.JWT_SECRET || "auth-route-test-secret";

const AppDataSource = require("../../db/data-source").default;
const AuthRouter = require("../../app/auth/routes/auth.route").default;
const { UserService } = require("../../app/user/services/user.service");
const { CrmLifecycleSyncService } = require("../../app/integrations/crm/services/crmLifecycleSync.service");
const { Roles } = require("../../middleware/auth");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

function mockGoogleResponse(payload: any, statusCode = 200) {
  return patch(https, "get", (_url: string, callback: (resp: any) => void) => {
    const response = new EventEmitter() as any;
    response.statusCode = statusCode;

    process.nextTick(() => {
      callback(response);
      response.emit("data", JSON.stringify(payload));
      response.emit("end");
    });

    return {
      on() {
        return this;
      },
    };
  });
}

async function startAuthApp() {
  const express = require("express");
  const app = express();

  app.use(express.json());
  app.use("/auth", new AuthRouter().getRouter());

  const server = await new Promise<any>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind auth test server");
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

test("AuthRouter: POST /auth/login returns user role metadata", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreLoginWithEmail = patch(
    UserService.prototype,
    "loginWithEmail",
    async () => ({
      user: {
        id: 8,
        email: "admin@example.com",
        name: "Admin User",
        isAdmin: true,
      },
      accessToken: "access-token-1234567890",
      refreshToken: "refresh-token-1234567890",
    })
  );

  let app: Awaited<ReturnType<typeof startAuthApp>> | null = null;

  try {
    app = await startAuthApp();
    const result = await requestJson(`${app.baseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "admin@example.com",
        password: "StrongPass123",
      }),
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.user.role, Roles.ADMIN);
    assert.deepEqual(result.body.user.roles, [Roles.ADMIN, Roles.USER]);
    assert.equal(result.body.user.isAdmin, true);
  } finally {
    restoreLoginWithEmail();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("AuthRouter: POST /auth/google supports referral code for first-time users", async () => {
  let capturedArgs: any[] | null = null;
  let syncedUserId: number | null = null;

  const restoreGoogleGet = mockGoogleResponse({
    sub: "google-sub-501",
    email: "google@example.com",
    name: "Google User",
    email_verified: "true",
  });
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreRegisterWithProvider = patch(
    UserService.prototype,
    "registerWithProvider",
    async (...args: any[]) => {
      capturedArgs = args;
      return {
        user: {
          id: 501,
          email: "google@example.com",
          name: "Google User",
          isAdmin: false,
        },
        accessToken: "access-token-1234567890",
        refreshToken: "refresh-token-1234567890",
        isNewUser: true,
      };
    }
  );
  const restoreSyncUserRegistered = patch(
    CrmLifecycleSyncService.prototype,
    "syncUserRegistered",
    async (userId: number) => {
      syncedUserId = userId;
    }
  );

  let app: Awaited<ReturnType<typeof startAuthApp>> | null = null;

  try {
    app = await startAuthApp();
    const result = await requestJson(`${app.baseUrl}/auth/google`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        id_token: "fake-google-token",
        referralCode: "AB12CD34",
      }),
    });

    assert.equal(result.status, 200);
    assert.deepEqual(capturedArgs, [
      "google",
      "google-sub-501",
      "google@example.com",
      "Google User",
      false,
      "AB12CD34",
    ]);
    assert.equal(syncedUserId, 501);
    assert.deepEqual(result.body.user, {
      id: 501,
      email: "google@example.com",
      name: "Google User",
      role: Roles.USER,
      roles: [Roles.USER],
      isAdmin: false,
    });
  } finally {
    restoreSyncUserRegistered();
    restoreRegisterWithProvider();
    restoreGetRepository();
    restoreGoogleGet();
    if (app) await app.close();
  }
});

test("AuthRouter: POST /auth/google returns invalid_referral_code for rejected first-time users", async () => {
  const restoreGoogleGet = mockGoogleResponse({
    sub: "google-sub-400",
    email: "invalid@example.com",
    name: "Invalid Referral",
    email_verified: "true",
  });
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreRegisterWithProvider = patch(
    UserService.prototype,
    "registerWithProvider",
    async () => {
      throw {
        statusCode: 400,
        message: "invalid_referral_code",
      };
    }
  );

  let app: Awaited<ReturnType<typeof startAuthApp>> | null = null;

  try {
    app = await startAuthApp();
    const result = await requestJson(`${app.baseUrl}/auth/google`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        id_token: "fake-google-token",
        referralCode: "BADCODE1",
      }),
    });

    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { message: "invalid_referral_code" });
  } finally {
    restoreRegisterWithProvider();
    restoreGetRepository();
    restoreGoogleGet();
    if (app) await app.close();
  }
});

test("AuthRouter: POST /auth/google skips registration sync for returning users even when referralCode is provided", async () => {
  let syncedUserId: number | null = null;

  const restoreGoogleGet = mockGoogleResponse({
    sub: "google-sub-777",
    email: "existing@example.com",
    name: "Existing User",
    email_verified: "true",
  });
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreRegisterWithProvider = patch(
    UserService.prototype,
    "registerWithProvider",
    async () => ({
      user: {
        id: 777,
        email: "existing@example.com",
        name: "Existing User",
        isAdmin: false,
      },
      accessToken: "existing-access-token-1234567890",
      refreshToken: "existing-refresh-token-1234567890",
      isNewUser: false,
    })
  );
  const restoreSyncUserRegistered = patch(
    CrmLifecycleSyncService.prototype,
    "syncUserRegistered",
    async (userId: number) => {
      syncedUserId = userId;
    }
  );

  let app: Awaited<ReturnType<typeof startAuthApp>> | null = null;

  try {
    app = await startAuthApp();
    const result = await requestJson(`${app.baseUrl}/auth/google`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        id_token: "fake-google-token",
        referralCode: "IGNORED01",
      }),
    });

    assert.equal(result.status, 200);
    assert.equal(syncedUserId, null);
    assert.equal(result.body.user.email, "existing@example.com");
  } finally {
    restoreSyncUserRegistered();
    restoreRegisterWithProvider();
    restoreGetRepository();
    restoreGoogleGet();
    if (app) await app.close();
  }
});
