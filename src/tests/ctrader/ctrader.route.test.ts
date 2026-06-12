import test from "node:test";
import assert from "node:assert/strict";

const AppDataSource = require("../../db/data-source").default;

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

function captureRawBody(req: any, _res: any, buf: Buffer) {
  if (req.originalUrl?.startsWith("/billing/razorpay/webhook")) {
    req.rawBody = buf;
  }
}

function isPayloadTooLargeError(err: any) {
  return (
    err?.type === "entity.too.large" ||
    Number(err?.status) === 413 ||
    Number(err?.statusCode) === 413
  );
}

function isCTraderSymbolReplaceRequest(req: any) {
  const path = String(req.originalUrl ?? req.path ?? "").split("?")[0];
  return (
    String(req.method ?? "").toUpperCase() === "PUT" &&
    /^\/ctrader\/symbols\/[^/]+\/(?:demo|live)\/[^/]+$/.test(path)
  );
}

async function startParserApp() {
  const express = require("express");
  const ctraderRouter = require("../../app/ctrader/ctraderRoutes").default;
  const alertRouter = require("../../app/broker/brokerAlerts/routes/alertSnapshot.route").default;
  const app = express();

  app.put(
    "/ctrader/symbols/:userId/:env/:accountId",
    express.json({
      limit: "5mb",
      verify: captureRawBody,
    }),
    (_req: any, _res: any, next: any) => next()
  );
  app.use(
    express.json({
      limit: "100kb",
      verify: captureRawBody,
    })
  );
  app.use(
    express.urlencoded({
      extended: true,
      limit: "100kb",
    })
  );

  app.use("/ctrader", ctraderRouter);
  app.use("/tradingview/alerts", alertRouter);
  app.use((err: any, req: any, res: any, next: any) => {
    if (!isPayloadTooLargeError(err)) {
      next(err);
      return;
    }

    const route = isCTraderSymbolReplaceRequest(req)
      ? "ctrader_symbols_replace"
      : "request_body";
    res.status(413).json({ error: "payload_too_large", route });
  });

  const server = await new Promise<any>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind ctrader test server");
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

test("cTrader symbol route accepts payloads above 100kb but below 5mb", async () => {
  const insertedRecords: any[] = [];
  const originalInternalApiKey = process.env.INTERNAL_API_KEY;
  process.env.INTERNAL_API_KEY = "test-internal-key";

  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({
    async delete() {
      return;
    },
    async insert(records: any[]) {
      insertedRecords.push(...records);
      return;
    },
  }));

  let app: Awaited<ReturnType<typeof startParserApp>> | null = null;

  try {
    app = await startParserApp();
    const items = Array.from({ length: 2500 }, (_, index) => ({
      symbol: `sym_${index}`,
      symbolId: index + 1,
      lotSize: 10000000,
      digits: 5,
      pipPosition: 4,
      slDistance: 20,
      tpDistance: 40,
      distanceSetIn: "SYMBOL_DISTANCE_IN_POINTS",
    }));
    const payload = { items, ttlSeconds: 60 };
    const payloadSize = Buffer.byteLength(JSON.stringify(payload), "utf8");

    assert.equal(payloadSize > 100 * 1024, true);
    assert.equal(payloadSize < 5 * 1024 * 1024, true);

    const result = await requestJson(`${app.baseUrl}/ctrader/symbols/2/demo/46887267`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-internal-api-key": "test-internal-key",
      },
      body: JSON.stringify(payload),
    });

    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { success: true });
    assert.equal(insertedRecords.length, items.length);
    assert.equal(insertedRecords[0].lotSize, "10000000");
    assert.equal(insertedRecords[0].pipPosition, 4);
  } finally {
    restoreGetRepository();
    if (originalInternalApiKey === undefined) {
      delete process.env.INTERNAL_API_KEY;
    } else {
      process.env.INTERNAL_API_KEY = originalInternalApiKey;
    }
    if (app) await app.close();
  }
});

test("cTrader symbol route returns structured 413 when payload exceeds 5mb", async () => {
  const originalInternalApiKey = process.env.INTERNAL_API_KEY;
  process.env.INTERNAL_API_KEY = "test-internal-key";

  let app: Awaited<ReturnType<typeof startParserApp>> | null = null;

  try {
    app = await startParserApp();
    const payload = {
      items: [
        {
          symbol: "A".repeat(5 * 1024 * 1024 + 1024),
          symbolId: 1,
        },
      ],
    };

    const result = await requestJson(`${app.baseUrl}/ctrader/symbols/2/demo/46887267`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-internal-api-key": "test-internal-key",
      },
      body: JSON.stringify(payload),
    });

    assert.equal(result.status, 413);
    assert.deepEqual(result.body, {
      error: "payload_too_large",
      route: "ctrader_symbols_replace",
    });
  } finally {
    if (originalInternalApiKey === undefined) {
      delete process.env.INTERNAL_API_KEY;
    } else {
      process.env.INTERNAL_API_KEY = originalInternalApiKey;
    }
    if (app) await app.close();
  }
});

test("normal JSON routes still reject oversized bodies with structured 413", async () => {
  let app: Awaited<ReturnType<typeof startParserApp>> | null = null;

  try {
    app = await startParserApp();
    const payload = {
      market: "FOREX",
      ticker: "EURUSD",
      exchange: "OANDA",
      action: "BUY",
      notes: "A".repeat(150 * 1024),
    };

    const result = await requestJson(`${app.baseUrl}/tradingview/alerts`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    assert.equal(result.status, 413);
    assert.deepEqual(result.body, {
      error: "payload_too_large",
      route: "request_body",
    });
  } finally {
    if (app) await app.close();
  }
});
