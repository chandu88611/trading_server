import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "copy-execution-route-test-secret";

const { default: copyExecutionRouter } = require("../../app/copyExecution/copyExecution.routes");
const { CopyExecutionService } = require("../../app/copyExecution/copyExecution.service");
const { signAccessToken, Roles } = require("../../middleware/auth");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

async function startCopyApp() {
  const express = require("express");
  const app = express();

  app.use(express.json());
  app.use("/copy", copyExecutionRouter);

  const server = await new Promise<any>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind copy execution test server");
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

test("CopyExecutionRouter: lists strategies and links for the current user", async () => {
  const captured: any[] = [];
  const restoreStrategies = patch(
    CopyExecutionService.prototype,
    "listStrategies",
    async (userId: number, mode: string) => {
      captured.push({ op: "strategies", userId, mode });
      return [{ id: 1, name: "Strategy" }];
    }
  );
  const restoreLinks = patch(
    CopyExecutionService.prototype,
    "listLinks",
    async (userId: number, mode: string) => {
      captured.push({ op: "links", userId, mode });
      return [{ strategyId: "1", targetAccountIds: ["9"] }];
    }
  );
  let app: Awaited<ReturnType<typeof startCopyApp>> | null = null;

  try {
    app = await startCopyApp();
    const headers = { authorization: `Bearer ${token(7, [Roles.USER])}` };
    const strategies = await requestJson(`${app.baseUrl}/copy/strategies?mode=FOREX`, { headers });
    const links = await requestJson(`${app.baseUrl}/copy/links?mode=INDIA`, { headers });

    assert.equal(strategies.status, 200);
    assert.equal(links.status, 200);
    assert.deepEqual(captured, [
      { op: "strategies", userId: 7, mode: "FOREX" },
      { op: "links", userId: 7, mode: "INDIA" },
    ]);
  } finally {
    restoreLinks();
    restoreStrategies();
    if (app) await app.close();
  }
});

test("CopyExecutionRouter: manual trade queues through the service", async () => {
  let captured: any = null;
  const restore = patch(
    CopyExecutionService.prototype,
    "placeManualTrade",
    async (userId: number, body: any) => {
      captured = { userId, body };
      return { requestId: "req_1", accepted: 1 };
    }
  );
  let app: Awaited<ReturnType<typeof startCopyApp>> | null = null;

  try {
    app = await startCopyApp();
    const body = { mode: "FOREX", targets: ["9"], symbol: "EURUSD", side: "BUY", lots: 0.1 };
    const result = await requestJson(`${app.baseUrl}/copy/manual-trade`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token(7, [Roles.USER])}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    assert.equal(result.status, 202);
    assert.equal(result.body.message, "manual_trade_queued");
    assert.deepEqual(captured, { userId: 7, body });
  } finally {
    restore();
    if (app) await app.close();
  }
});
