import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "zebu-route-test-secret";

import { ZebuRouter } from "../../app/zebu/routes/zebu";
import { ZebuService } from "../../app/zebu/services/zebu.service";
import { Roles } from "../../middleware/auth";

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

function accessToken(userId: number, roles: Roles[] = [Roles.USER]) {
  return jwt.sign({ userId, roles, type: "access" }, process.env.JWT_SECRET as string, {
    expiresIn: "1h",
  });
}

async function startZebuApp() {
  const express = require("express");
  const app = express();

  app.use(express.json());
  app.use("/zebu", new ZebuRouter().getRouter());

  const server = await new Promise<any>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind zebu route test server");
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

test("ZebuRouter: GET and POST order reads use authenticated userId, not request body/query userId", async () => {
  const calls: Array<{ userId: number; tradingAccountId: number }> = [];
  const restoreGetOrders = patch(
    ZebuService.prototype,
    "getOrders",
    async (userId: number, tradingAccountId: number) => {
      calls.push({ userId, tradingAccountId });
      return [{ ok: true }];
    }
  );

  let app: Awaited<ReturnType<typeof startZebuApp>> | null = null;

  try {
    app = await startZebuApp();
    const token = accessToken(12);

    const postResult = await requestJson(`${app.baseUrl}/zebu/orders`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId: 999,
        tradingAccountId: 45,
      }),
    });

    const getResult = await requestJson(`${app.baseUrl}/zebu/orders?userId=999&tradingAccountId=46`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(postResult.status, 200);
    assert.equal(getResult.status, 200);
    assert.deepEqual(calls, [
      { userId: 12, tradingAccountId: 45 },
      { userId: 12, tradingAccountId: 46 },
    ]);
  } finally {
    restoreGetOrders();
    if (app) await app.close();
  }
});

test("ZebuRouter: read endpoints enforce auth and tradingAccountId validation", async () => {
  const restoreGetPositions = patch(
    ZebuService.prototype,
    "getPositions",
    async () => [{ ok: true }]
  );

  let app: Awaited<ReturnType<typeof startZebuApp>> | null = null;

  try {
    app = await startZebuApp();

    const unauthorized = await requestJson(`${app.baseUrl}/zebu/positions?tradingAccountId=45`, {
      method: "GET",
    });
    assert.equal(unauthorized.status, 401);

    const missingAccount = await requestJson(`${app.baseUrl}/zebu/positions`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken(12)}`,
      },
    });
    assert.equal(missingAccount.status, 400);
    assert.deepEqual(missingAccount.body, { message: "tradingAccountId_required" });
  } finally {
    restoreGetPositions();
    if (app) await app.close();
  }
});

test("ZebuRouter: generate token accepts factor2 and validates missing factor2", async () => {
  const calls: any[] = [];
  const restoreGenerate = patch(
    ZebuService.prototype,
    "generateAndSaveTokenUsingTotp",
    async (payload: any) => {
      calls.push(payload);
      return { ok: true, tokenStored: true };
    }
  );

  let app: Awaited<ReturnType<typeof startZebuApp>> | null = null;

  try {
    app = await startZebuApp();
    const token = accessToken(12);

    const ok = await requestJson(`${app.baseUrl}/zebu/auth/token/generate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tradingAccountId: 45,
        password: "pass",
        factor2: "123456",
      }),
    });
    assert.equal(ok.status, 200);
    assert.equal(calls[0].userId, 12);
    assert.equal(calls[0].factor2, "123456");

    const missing = await requestJson(`${app.baseUrl}/zebu/auth/token/generate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tradingAccountId: 45,
        password: "pass",
      }),
    });
    assert.equal(missing.status, 400);
    assert.deepEqual(missing.body, { message: "factor2_required" });
  } finally {
    restoreGenerate();
    if (app) await app.close();
  }
});

test("ZebuRouter: execute-pending is admin-only", async () => {
  const calls: any[] = [];
  const restoreExecute = patch(
    ZebuService.prototype,
    "executePendingBatch",
    async (payload: any) => {
      calls.push(payload);
      return { ok: true, processed: 0 };
    }
  );

  let app: Awaited<ReturnType<typeof startZebuApp>> | null = null;

  try {
    app = await startZebuApp();

    const userResult = await requestJson(`${app.baseUrl}/zebu/execute-pending`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken(12, [Roles.USER])}`,
      },
      body: JSON.stringify({ batchSize: 1 }),
    });
    assert.equal(userResult.status, 403);
    assert.deepEqual(userResult.body, { message: "Forbidden" });

    const adminResult = await requestJson(`${app.baseUrl}/zebu/execute-pending`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken(1, [Roles.ADMIN])}`,
      },
      body: JSON.stringify({ batchSize: 2 }),
    });
    assert.equal(adminResult.status, 200);
    assert.deepEqual(calls, [{ batchSize: 2 }]);
  } finally {
    restoreExecute();
    if (app) await app.close();
  }
});
