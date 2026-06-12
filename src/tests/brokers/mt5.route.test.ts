import test from "node:test";
import assert from "node:assert/strict";

import { Mt5ListenerRouter } from "../../app/mt5Listener/mt5Listener.routes";
import { Mt5ListenerServices } from "../../app/mt5Listener/mt5Listener.services";

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

async function startMt5App() {
  const express = require("express");
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/signal", new Mt5ListenerRouter().getRouter());

  const server = await new Promise<any>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind mt5 route test server");
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

test("MT5Router: GET /signal returns the next signal for the query userId", async () => {
  const calls: string[] = [];
  const restore = patch(
    Mt5ListenerServices.prototype,
    "getSignalForEA",
    async (brokerAccountId: string) => {
      calls.push(brokerAccountId);
      return {
        ackId: 501,
        side: "buy",
        symbol: "EURUSD",
        qty: 0.1,
        executionMode: "OPEN",
        orderType: "MARKET",
      };
    },
  );

  let app: Awaited<ReturnType<typeof startMt5App>> | null = null;
  try {
    app = await startMt5App();
    const result = await requestJson(`${app.baseUrl}/signal?userId=MT5-123`);

    assert.equal(result.status, 200);
    assert.deepEqual(calls, ["MT5-123"]);
    assert.equal(result.body.ackId, 501);
    assert.equal(result.body.orderType, "MARKET");
  } finally {
    restore();
    if (app) await app.close();
  }
});

test("MT5Router: POST /signal/ack accepts MT5 form-encoded raw JSON with ampersands", async () => {
  const seen: any[] = [];
  const restore = patch(Mt5ListenerServices.prototype, "handleAck", async (body: any) => {
    seen.push(body);
  });

  let app: Awaited<ReturnType<typeof startMt5App>> | null = null;
  try {
    app = await startMt5App();
    const rawJson = '{"ackId":502,"status":"success","message":"filled & confirmed","brokerOrderId":"8002"}';
    const result = await requestJson(`${app.baseUrl}/signal/ack`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: rawJson,
    });

    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { ok: true });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].ackId, 502);
    assert.equal(seen[0].message, "filled & confirmed");
    assert.equal(seen[0].brokerOrderId, "8002");
  } finally {
    restore();
    if (app) await app.close();
  }
});

test("MT5Router: POST /signal/state accepts body account_login and symbol items", async () => {
  const seen: Array<{ brokerAccountId: string; payload: any }> = [];
  const restore = patch(
    Mt5ListenerServices.prototype,
    "handleState",
    async (brokerAccountId: string, payload: any) => {
      seen.push({ brokerAccountId, payload });
      return { ok: true, brokerAccountId: brokerAccountId || String(payload.account_login), count: 1 };
    },
  );

  let app: Awaited<ReturnType<typeof startMt5App>> | null = null;
  try {
    app = await startMt5App();
    const result = await requestJson(`${app.baseUrl}/signal/state`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        account_login: 123456,
        items: [{ symbol: "EURUSD", digits: 5, point: 0.00001 }],
        positions: [{ ticket: 11, symbol: "EURUSD" }],
      }),
    });

    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { ok: true, brokerAccountId: "123456", count: 1 });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].brokerAccountId, "");
    assert.equal(seen[0].payload.account_login, 123456);
    assert.equal(seen[0].payload.items[0].symbol, "EURUSD");
  } finally {
    restore();
    if (app) await app.close();
  }
});
