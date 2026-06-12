import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "strategy-route-test-secret";

const AppDataSource = require("../../db/data-source").default;
const { StrategyService } = require("../../app/strategy/strategy");
const { signAccessToken, Roles } = require("../../middleware/auth");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

async function startStrategyApp() {
  const express = require("express");
  const { StrategyRouter } = require("../../app/strategy/routes/strategy.route");
  const app = express();

  app.use(express.json());
  app.use("/strategy", new StrategyRouter().getRouter());

  const server = await new Promise<any>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind strategy test server");
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

test("StrategyRouter: USER list only requests available strategies", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let captured: any = null;
  const restoreList = patch(StrategyService.prototype, "list", async (query: any) => {
    captured = query;
    return {
      rows: [{ id: 1, name: "Strategy 1" }],
      total: 1,
    };
  });

  let app: Awaited<ReturnType<typeof startStrategyApp>> | null = null;

  try {
    app = await startStrategyApp();
    const result = await requestJson(
      `${app.baseUrl}/strategy?isActive=false&isDeprecated=true`,
      {
        headers: {
          authorization: `Bearer ${createToken(77, [Roles.USER])}`,
        },
      }
    );

    assert.equal(result.status, 200);
    assert.equal(result.body.total, 1);
    assert.deepEqual(captured, {
      availableOnly: true,
      isActive: undefined,
      isDeprecated: undefined,
      category: undefined,
      searchParam: undefined,
      chunkSize: 20,
      initialOffset: 0,
    });
  } finally {
    restoreList();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("StrategyRouter: ADMIN list passes catalog filters", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let captured: any = null;
  const restoreList = patch(StrategyService.prototype, "list", async (query: any) => {
    captured = query;
    return {
      rows: [],
      total: 0,
    };
  });

  let app: Awaited<ReturnType<typeof startStrategyApp>> | null = null;

  try {
    app = await startStrategyApp();
    const result = await requestJson(
      `${app.baseUrl}/strategy?isActive=false&isDeprecated=true&category=forex&searchParam=gold&chunkSize=5&initialOffset=10`,
      {
        headers: {
          authorization: `Bearer ${createToken(1, [Roles.ADMIN])}`,
        },
      }
    );

    assert.equal(result.status, 200);
    assert.deepEqual(captured, {
      availableOnly: false,
      isActive: false,
      isDeprecated: true,
      category: "forex",
      searchParam: "gold",
      chunkSize: 5,
      initialOffset: 10,
    });
  } finally {
    restoreList();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("StrategyRouter: ADMIN can create a strategy catalog item", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let captured: any = null;
  const restoreCreate = patch(StrategyService.prototype, "create", async (payload: any) => {
    captured = payload;
    return { id: 9, ...payload };
  });

  let app: Awaited<ReturnType<typeof startStrategyApp>> | null = null;

  try {
    app = await startStrategyApp();
    const body = {
      strategyCode: "ALGO_9",
      name: "Algo 9",
      category: "forex",
      defaultParams: { risk: "medium" },
    };
    const result = await requestJson(`${app.baseUrl}/strategy`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${createToken(1, [Roles.ADMIN])}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    assert.equal(result.status, 201);
    assert.deepEqual(captured, body);
    assert.equal(result.body.message, "Strategy created");
  } finally {
    restoreCreate();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("StrategyRouter: USER cannot create strategy catalog items", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreCreate = patch(StrategyService.prototype, "create", async () => {
    throw new Error("create should not be called");
  });

  let app: Awaited<ReturnType<typeof startStrategyApp>> | null = null;

  try {
    app = await startStrategyApp();
    const result = await requestJson(`${app.baseUrl}/strategy`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${createToken(77, [Roles.USER])}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Algo", category: "forex" }),
    });

    assert.equal(result.status, 403);
    assert.deepEqual(result.body, { message: "Forbidden" });
  } finally {
    restoreCreate();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("StrategyRouter: ADMIN can update and soft retire strategies", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const captured: any[] = [];
  const restoreUpdate = patch(
    StrategyService.prototype,
    "update",
    async (strategyId: number, payload: any) => {
      captured.push({ operation: "update", strategyId, payload });
      return { id: strategyId, ...payload };
    }
  );
  const restoreRetire = patch(
    StrategyService.prototype,
    "retire",
    async (strategyId: number) => {
      captured.push({ operation: "retire", strategyId });
      return { id: strategyId, isActive: false, isDeprecated: true };
    }
  );

  let app: Awaited<ReturnType<typeof startStrategyApp>> | null = null;

  try {
    app = await startStrategyApp();
    const updateResult = await requestJson(`${app.baseUrl}/strategy/12`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${createToken(1, [Roles.ADMIN])}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ version: 2, defaultParams: { mode: "next" } }),
    });
    const retireResult = await requestJson(`${app.baseUrl}/strategy/12`, {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${createToken(1, [Roles.ADMIN])}`,
      },
    });

    assert.equal(updateResult.status, 200);
    assert.equal(retireResult.status, 200);
    assert.deepEqual(captured, [
      {
        operation: "update",
        strategyId: 12,
        payload: { version: 2, defaultParams: { mode: "next" } },
      },
      { operation: "retire", strategyId: 12 },
    ]);
    assert.equal(retireResult.body.message, "Strategy retired");
  } finally {
    restoreRetire();
    restoreUpdate();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("StrategyRouter: get strategy scopes visibility by caller role", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const captured: any[] = [];
  const restoreGetById = patch(
    StrategyService.prototype,
    "getById",
    async (strategyId: number, options: any) => {
      captured.push({ strategyId, options });
      return { id: strategyId, name: "Strategy" };
    }
  );

  let app: Awaited<ReturnType<typeof startStrategyApp>> | null = null;

  try {
    app = await startStrategyApp();
    await requestJson(`${app.baseUrl}/strategy/12`, {
      headers: {
        authorization: `Bearer ${createToken(77, [Roles.USER])}`,
      },
    });
    await requestJson(`${app.baseUrl}/strategy/12`, {
      headers: {
        authorization: `Bearer ${createToken(1, [Roles.ADMIN])}`,
      },
    });

    assert.deepEqual(captured, [
      { strategyId: 12, options: { availableOnly: true, userId: 77 } },
      { strategyId: 12, options: { availableOnly: false, userId: 1 } },
    ]);
  } finally {
    restoreGetById();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("StrategyRouter: USER can save strategy subscription settings", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let captured: any = null;
  const restoreSubscribe = patch(
    StrategyService.prototype,
    "subscribe",
    async (userId: number, strategyId: number, payload: any) => {
      captured = { userId, strategyId, payload };
      return { id: 51, strategyId, tradingAccountId: payload.accountId };
    }
  );

  let app: Awaited<ReturnType<typeof startStrategyApp>> | null = null;

  try {
    app = await startStrategyApp();
    const payload = {
      accountId: 44,
      autoCopy: true,
      allocationMode: "percent",
      percent: 10,
    };
    const result = await requestJson(`${app.baseUrl}/strategy/12/subscribe`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${createToken(77, [Roles.USER])}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.message, "strategy_subscription_saved");
    assert.deepEqual(captured, { userId: 77, strategyId: 12, payload });
  } finally {
    restoreSubscribe();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("StrategyRouter: USER can fetch per-strategy account performance", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let captured: any = null;
  const restorePerformance = patch(
    StrategyService.prototype,
    "getMyPerformance",
    async (userId: number, strategyId: number, accountId: number | null) => {
      captured = { userId, strategyId, accountId };
      return { realizedPnl: 12, unrealizedPnl: 3, tradesCopied: 2 };
    }
  );

  let app: Awaited<ReturnType<typeof startStrategyApp>> | null = null;

  try {
    app = await startStrategyApp();
    const result = await requestJson(
      `${app.baseUrl}/strategy/12/my-performance?accountId=44`,
      {
        headers: {
          authorization: `Bearer ${createToken(77, [Roles.USER])}`,
        },
      }
    );

    assert.equal(result.status, 200);
    assert.equal(result.body.message, "strategy_my_performance");
    assert.deepEqual(captured, { userId: 77, strategyId: 12, accountId: 44 });
  } finally {
    restorePerformance();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("StrategyRouter: USER can enable their own strategy by strategy id", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let captured: any = null;

  const restoreUserEnable = patch(
    StrategyService.prototype,
    "setUserStrategyStatusByStrategyId",
    async (userId: number, strategyId: number, status: "active" | "paused") => {
      captured = { userId, strategyId, status };
      return { id: 88, strategyId, status };
    }
  );

  const restoreAdminEnable = patch(
    StrategyService.prototype,
    "setStrategyActive",
    async () => {
      throw new Error("admin branch should not be called");
    }
  );

  let app: Awaited<ReturnType<typeof startStrategyApp>> | null = null;

  try {
    app = await startStrategyApp();
    const result = await requestJson(`${app.baseUrl}/strategy/12/enable`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${createToken(77, [Roles.USER])}`,
      },
    });

    assert.equal(result.status, 200);
    assert.deepEqual(captured, { userId: 77, strategyId: 12, status: "active" });
    assert.equal(result.body.message, "user_strategy_enabled");
  } finally {
    restoreAdminEnable();
    restoreUserEnable();
    restoreGetRepository();
    if (app) await app.close();
  }
});

test("StrategyRouter: ADMIN enable keeps the global strategy toggle behavior", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let captured: any = null;

  const restoreAdminEnable = patch(
    StrategyService.prototype,
    "setStrategyActive",
    async (strategyId: number, isActive: boolean) => {
      captured = { strategyId, isActive };
      return { id: strategyId, isActive };
    }
  );

  let app: Awaited<ReturnType<typeof startStrategyApp>> | null = null;

  try {
    app = await startStrategyApp();
    const result = await requestJson(`${app.baseUrl}/strategy/12/enable`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${createToken(1, [Roles.ADMIN, Roles.USER])}`,
      },
    });

    assert.equal(result.status, 200);
    assert.deepEqual(captured, { strategyId: 12, isActive: true });
    assert.equal(result.body.message, "strategy_enabled");
  } finally {
    restoreAdminEnable();
    restoreGetRepository();
    if (app) await app.close();
  }
});
