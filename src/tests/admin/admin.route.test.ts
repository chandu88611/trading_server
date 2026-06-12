import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "admin-route-test-secret";

const { default: adminRouter } = require("../../app/admin/admin.routes");
const { AdminService } = require("../../app/admin/admin.service");
const { signAccessToken, Roles } = require("../../middleware/auth");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

async function startAdminApp() {
  const express = require("express");
  const app = express();

  app.use(express.json());
  app.use("/admin", adminRouter);

  const server = await new Promise<any>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind admin test server");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((error?: Error | null) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

function token(userId: number, roles: string[]) {
  return signAccessToken({ userId: String(userId), roles });
}

test("AdminRouter: rejects non-admin callers at the route guard", async () => {
  const restore = patch(AdminService.prototype, "getSettings", async () => {
    throw new Error("getSettings should not be called");
  });
  let app: Awaited<ReturnType<typeof startAdminApp>> | null = null;

  try {
    app = await startAdminApp();
    const result = await requestJson(`${app.baseUrl}/admin/settings`, {
      headers: { authorization: `Bearer ${token(7, [Roles.USER])}` },
    });

    assert.equal(result.status, 403);
    assert.deepEqual(result.body, { message: "Forbidden" });
  } finally {
    restore();
    if (app) await app.close();
  }
});

test("AdminRouter: exposes settings and payments contracts", async () => {
  const restoreSettings = patch(AdminService.prototype, "getSettings", async () => ({
    title: "TradeBro",
  }));
  const restorePayments = patch(AdminService.prototype, "listPayments", async (query: any) => ({
    rows: [],
    total: 0,
    limit: Number(query.limit ?? 50),
    offset: 0,
  }));
  let app: Awaited<ReturnType<typeof startAdminApp>> | null = null;

  try {
    app = await startAdminApp();
    const headers = { authorization: `Bearer ${token(1, [Roles.ADMIN])}` };
    const settings = await requestJson(`${app.baseUrl}/admin/settings`, { headers });
    const payments = await requestJson(`${app.baseUrl}/admin/payments?limit=5`, { headers });

    assert.equal(settings.status, 200);
    assert.deepEqual(settings.body.data, { title: "TradeBro" });
    assert.equal(payments.status, 200);
    assert.deepEqual(payments.body.data, { rows: [], total: 0, limit: 5, offset: 0 });
  } finally {
    restorePayments();
    restoreSettings();
    if (app) await app.close();
  }
});
