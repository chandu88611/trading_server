import test from "node:test";
import assert from "node:assert/strict";

import AppDataSource from "../../db/data-source";
import { CTraderService } from "../../app/cTraderListener/services/cTrader";

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

function completeOAuthHarness({
  accountSubscriptionId,
  activeSubscriptionId,
}: {
  accountSubscriptionId: number | null;
  activeSubscriptionId: number | null;
}) {
  const account: any = {
    id: 77,
    userId: 9,
    accountId: "46348187",
    subscriptionId: accountSubscriptionId,
    accessToken: "old-access",
    refreshToken: "old-refresh",
    status: "pending",
    lastVerifiedAt: null,
  };
  const broker = { id: 1, code: "CT", marketCategory: "FOREX" };
  const activeSubscription = activeSubscriptionId
    ? { id: activeSubscriptionId }
    : null;
  let savedAccount: any = null;
  let committed = false;
  let rolledBack = false;

  const chain = (getOne: () => Promise<any>) => ({
    setLock() {
      return this;
    },
    where() {
      return this;
    },
    andWhere() {
      return this;
    },
    innerJoinAndSelect() {
      return this;
    },
    orderBy() {
      return this;
    },
    addOrderBy() {
      return this;
    },
    getOne,
  });

  const queryRunner = {
    connect: async () => undefined,
    startTransaction: async () => undefined,
    commitTransaction: async () => {
      committed = true;
    },
    rollbackTransaction: async () => {
      rolledBack = true;
    },
    release: async () => undefined,
    manager: {
      getRepository(entity: any) {
        if (entity?.name === "UserTradingAccount") {
          return {
            createQueryBuilder: () => chain(async () => account),
            save: async (nextAccount: any) => {
              savedAccount = { ...nextAccount };
              return nextAccount;
            },
          };
        }
        if (entity?.name === "Broker") {
          return {
            findOne: async () => broker,
          };
        }
        if (entity?.name === "UserSubscription") {
          return {
            createQueryBuilder: () => chain(async () => activeSubscription),
          };
        }
        return {};
      },
    },
  };

  return {
    account,
    queryRunner,
    get savedAccount() {
      return savedAccount;
    },
    get committed() {
      return committed;
    },
    get rolledBack() {
      return rolledBack;
    },
  };
}

test("cTrader: checkConnection healthy JSON response", async () => {
  const originalFetch = global.fetch;

  global.fetch = (async () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as any;

  try {
    const service = new CTraderService({ baseUrl: "http://fake-gw", timeoutMs: 1000 });
    const result = await service.checkConnection();

    assert.equal(result.ok, true);
    assert.equal(result.status, 200);
    assert.equal(result.url, "http://fake-gw/health");
  } finally {
    global.fetch = originalFetch;
  }
});

test("cTrader: checkConnection treats unhealthy gateway readiness as down", async () => {
  const originalFetch = global.fetch;

  global.fetch = (async () =>
    new Response(JSON.stringify({ ok: false, connected: true, appAuthed: false, env: "demo" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    })) as any;

  try {
    const service = new CTraderService({ baseUrl: "http://fake-gw", timeoutMs: 1000 });
    const result = await service.checkConnection();

    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    assert.equal(result.url, "http://fake-gw/health");
  } finally {
    global.fetch = originalFetch;
  }
});

test("cTrader: exchangeCodeDirect validates missing input", async () => {
  const service = new CTraderService({ baseUrl: "http://fake-gw", timeoutMs: 1000 });

  await assert.rejects(async () => service.exchangeCodeDirect(""), /code_required/);
  await assert.rejects(async () => service.refreshTokenDirect(""), /refresh_token_required/);
});

test("cTrader: OAuth completion rebinds existing account to active market subscription", async () => {
  const harness = completeOAuthHarness({
    accountSubscriptionId: 23,
    activeSubscriptionId: 30,
  });
  const restoreCreateQueryRunner = patch(
    AppDataSource,
    "createQueryRunner",
    () => harness.queryRunner,
  );

  try {
    const service = new CTraderService({ baseUrl: "http://fake-gw", timeoutMs: 1000 });
    const restoreExchange = patch(service, "exchangeCodeDirect", async () => ({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      expiresIn: 3600,
    }));

    try {
      const result = await service.completeOAuthAndVerifyByCTraderAccountId(
        "46348187",
        "oauth-code",
      );

      assert.equal(result.ok, true);
      assert.equal(harness.savedAccount.subscriptionId, 30);
      assert.equal(harness.savedAccount.accessToken, "new-access");
      assert.equal(harness.savedAccount.refreshToken, "new-refresh");
      assert.equal(harness.savedAccount.status, "verified");
      assert.equal(harness.committed, true);
      assert.equal(harness.rolledBack, false);
    } finally {
      restoreExchange();
    }
  } finally {
    restoreCreateQueryRunner();
  }
});

test("cTrader: OAuth completion leaves account on active subscription when already current", async () => {
  const harness = completeOAuthHarness({
    accountSubscriptionId: 30,
    activeSubscriptionId: 30,
  });
  const restoreCreateQueryRunner = patch(
    AppDataSource,
    "createQueryRunner",
    () => harness.queryRunner,
  );

  try {
    const service = new CTraderService({ baseUrl: "http://fake-gw", timeoutMs: 1000 });
    const restoreExchange = patch(service, "exchangeCodeDirect", async () => ({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      expiresIn: 3600,
    }));

    try {
      const result = await service.completeOAuthAndVerifyByCTraderAccountId(
        "46348187",
        "oauth-code",
      );

      assert.equal(result.ok, true);
      assert.equal(harness.savedAccount.subscriptionId, 30);
      assert.equal(harness.committed, true);
      assert.equal(harness.rolledBack, false);
    } finally {
      restoreExchange();
    }
  } finally {
    restoreCreateQueryRunner();
  }
});

test("cTrader: OAuth completion keeps existing subscription when no active market subscription exists", async () => {
  const harness = completeOAuthHarness({
    accountSubscriptionId: 23,
    activeSubscriptionId: null,
  });
  const restoreCreateQueryRunner = patch(
    AppDataSource,
    "createQueryRunner",
    () => harness.queryRunner,
  );

  try {
    const service = new CTraderService({ baseUrl: "http://fake-gw", timeoutMs: 1000 });
    const restoreExchange = patch(service, "exchangeCodeDirect", async () => ({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      expiresIn: 3600,
    }));

    try {
      const result = await service.completeOAuthAndVerifyByCTraderAccountId(
        "46348187",
        "oauth-code",
      );

      assert.equal(result.ok, true);
      assert.equal(harness.savedAccount.subscriptionId, 23);
      assert.equal(harness.committed, true);
      assert.equal(harness.rolledBack, false);
    } finally {
      restoreExchange();
    }
  } finally {
    restoreCreateQueryRunner();
  }
});

test("cTrader: execute trade handles gateway proto error response", async () => {
  const originalFetch = global.fetch;

  global.fetch = (async (input: any) => {
    const url = String(input);

    if (url.endsWith("/accounts")) {
      return new Response(
        JSON.stringify({
          items: [{ ctidTraderAccountId: 46021074 }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        response: { payloadType: "PROTO_OA_ERROR_RES", payload: { reason: "no_account_auth" } },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  }) as any;

  try {
    const service = new CTraderService({ baseUrl: "http://fake-gw", timeoutMs: 1000 });
    (service as any).db = {
      async updateTradingAccountAccountId() {
        return;
      },
    };

    const result = await service.exectuteTradeSignalApiCall({
      userId: 99,
      tradingAccountId: 901,
      accessToken: "ctrader-access-token",
      symbol: "EURUSD",
      side: "BUY",
      qty: 1000,
      accountId: 46021074,
    });

    assert.equal(result.ok, false);
    assert.equal(result.error, "ctrader_proto_error_res");
    assert.equal(result.status, 200);
  } finally {
    global.fetch = originalFetch;
  }
});

test("cTrader: execute trade forwards strategy lot volume instead of falling back to default units", async () => {
  const originalFetch = global.fetch;
  const seenBodies: any[] = [];

  global.fetch = (async (input: any, init?: RequestInit) => {
    const url = String(input);

    if (url.endsWith("/accounts")) {
      return new Response(
        JSON.stringify({
          items: [{ ctidTraderAccountId: 46021074 }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    }

    if (init?.body) {
      seenBodies.push(JSON.parse(String(init.body)));
    }

    return new Response(
      JSON.stringify({
        response: {
          payloadType: "PROTO_OA_EXECUTION_EVENT",
          order: { orderId: 123 },
          position: { positionId: 456 },
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  }) as any;

  try {
    const service = new CTraderService({ baseUrl: "http://fake-gw", timeoutMs: 1000 });
    (service as any).db = {
      async updateTradingAccountAccountId() {
        return;
      },
    };

    const result = await service.exectuteTradeSignalApiCall({
      id: 7271,
      userId: 99,
      tradingAccountId: 901,
      accessToken: "ctrader-access-token",
      symbol: "XAUUSD",
      action: "BUY",
      volume: 0.01,
      accountId: 46021074,
    });

    assert.equal(result.ok, true);
    assert.equal(seenBodies.length, 1);
    assert.equal(seenBodies[0].volumeLots, 0.01);
    assert.equal("volumeUnits" in seenBodies[0], false);
  } finally {
    global.fetch = originalFetch;
  }
});

test("cTrader: execute trade forwards whole-number SL/TP distances to gateway", async () => {
  const originalFetch = global.fetch;
  const seenBodies: any[] = [];

  global.fetch = (async (input: any, init?: RequestInit) => {
    const url = String(input);

    if (url.endsWith("/accounts")) {
      return new Response(
        JSON.stringify({
          items: [{ ctidTraderAccountId: 46021074 }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    }

    if (init?.body) {
      seenBodies.push(JSON.parse(String(init.body)));
    }

    return new Response(
      JSON.stringify({
        response: {
          payloadType: "PROTO_OA_EXECUTION_EVENT",
          order: { orderId: 123 },
          position: { positionId: 456 },
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  }) as any;

  try {
    const service = new CTraderService({ baseUrl: "http://fake-gw", timeoutMs: 1000 });
    (service as any).db = {
      async updateTradingAccountAccountId() {
        return;
      },
    };

    const result = await service.exectuteTradeSignalApiCall({
      id: 8049,
      userId: 2,
      tradingAccountId: 43,
      accessToken: "ctrader-access-token",
      symbol: "EURUSD",
      side: "SELL",
      volume: 0.01,
      accountId: 46021074,
      stopLossDistance: 7,
      takeProfitDistance: 10,
      breakEvenActivationDistance: 10,
      breakEvenOffsetDistance: 2,
      trailingStopLossDistance: 7,
    });

    assert.equal(result.ok, true);
    assert.equal(seenBodies.length, 1);
    assert.equal(seenBodies[0].stopLossDistance, 7);
    assert.equal(seenBodies[0].takeProfitDistance, 10);
    assert.equal(seenBodies[0].breakEvenActivationDistance, 10);
    assert.equal(seenBodies[0].breakEvenOffsetDistance, 2);
    assert.equal(seenBodies[0].trailingStopLossDistance, 7);
  } finally {
    global.fetch = originalFetch;
  }
});

test("cTrader: execute trade forwards XAUUSD distances without app-side mapping", async () => {
  const originalFetch = global.fetch;
  const seenBodies: any[] = [];

  global.fetch = (async (input: any, init?: RequestInit) => {
    const url = String(input);

    if (url.endsWith("/accounts")) {
      return new Response(
        JSON.stringify({
          items: [{ ctidTraderAccountId: 46021074 }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    }

    if (init?.body) {
      seenBodies.push(JSON.parse(String(init.body)));
    }

    return new Response(
      JSON.stringify({
        response: {
          payloadType: "PROTO_OA_EXECUTION_EVENT",
          order: { orderId: 123 },
          position: { positionId: 456 },
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  }) as any;

  try {
    const service = new CTraderService({ baseUrl: "http://fake-gw", timeoutMs: 1000 });
    (service as any).db = {
      async updateTradingAccountAccountId() {
        return;
      },
    };

    const result = await service.exectuteTradeSignalApiCall({
      id: 8120,
      userId: 2,
      tradingAccountId: 43,
      accessToken: "ctrader-access-token",
      symbol: "XAUUSD",
      side: "SELL",
      volume: 0.01,
      accountId: 46021074,
      stopLossDistance: 10,
      takeProfitDistance: 20,
    });

    assert.equal(result.ok, true);
    assert.equal(seenBodies.length, 1);
    assert.equal(seenBodies[0].stopLossDistance, 10);
    assert.equal(seenBodies[0].takeProfitDistance, 20);
  } finally {
    global.fetch = originalFetch;
  }
});

test("cTrader: execute trade lets gateway validate unknown symbols", async () => {
  const originalFetch = global.fetch;
  const seenBodies: any[] = [];

  global.fetch = (async (input: any, init?: RequestInit) => {
    const url = String(input);

    if (url.endsWith("/accounts")) {
      return new Response(
        JSON.stringify({
          items: [{ ctidTraderAccountId: 46021074 }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    }

    if (init?.body) {
      seenBodies.push(JSON.parse(String(init.body)));
    }

    return new Response(
      JSON.stringify({
        response: {
          payloadType: "PROTO_OA_EXECUTION_EVENT",
          order: { orderId: 123 },
          position: { positionId: 456 },
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  }) as any;

  try {
    const service = new CTraderService({ baseUrl: "http://fake-gw", timeoutMs: 1000 });
    (service as any).db = {
      async updateTradingAccountAccountId() {
        return;
      },
    };

    const result = await service.exectuteTradeSignalApiCall({
      id: 8121,
      userId: 2,
      tradingAccountId: 43,
      accessToken: "ctrader-access-token",
      symbol: "FOOBAR",
      side: "SELL",
      volume: 0.01,
      accountId: 46021074,
      stopLossDistance: 10,
    });

    assert.equal(result.ok, true);
    assert.equal(seenBodies.length, 1);
    assert.equal(seenBodies[0].symbol, "FOOBAR");
    assert.equal(seenBodies[0].stopLossDistance, 10);
  } finally {
    global.fetch = originalFetch;
  }
});

test("cTrader: execute trade fails when gateway returns zero broker refs", async () => {
  const originalFetch = global.fetch;

  global.fetch = (async (input: any) => {
    const url = String(input);

    if (url.endsWith("/accounts")) {
      return new Response(
        JSON.stringify({
          items: [{ ctidTraderAccountId: 46021074 }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        response: {
          payloadType: "PROTO_OA_EXECUTION_EVENT",
          order: { orderId: 0 },
          position: { positionId: 0 },
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  }) as any;

  try {
    const service = new CTraderService({ baseUrl: "http://fake-gw", timeoutMs: 1000 });
    (service as any).db = {
      async updateTradingAccountAccountId() {
        return;
      },
    };

    const result = await service.exectuteTradeSignalApiCall({
      userId: 99,
      tradingAccountId: 901,
      accessToken: "ctrader-access-token",
      symbol: "EURUSD",
      side: "BUY",
      qty: 1000,
      accountId: 46021074,
    });

    assert.equal(result.ok, false);
    assert.equal(result.error, "execution_missing_broker_refs");
    assert.equal(result.orderId, undefined);
    assert.equal(result.positionId, undefined);
  } finally {
    global.fetch = originalFetch;
  }
});

test("cTrader: executePendingBatch requeues transient failures instead of marking them failed immediately", async () => {
  const service = new CTraderService({
    baseUrl: "http://fake-gw",
    timeoutMs: 1000,
    maxRetryAttempts: 5,
    retryBaseDelayMs: 250,
  });

  let updates: any[] = [];

  (service as any).isHealthy = async () => true;
  (service as any).db = {
    async claimPendingTrades() {
      return [{ id: 7255 }];
    },
    async updateTradeStatus(payload: any[]) {
      updates = payload;
    },
  };
  (service as any).exectuteTradeSignalApiCall = async () => ({
    ok: false,
    error: "timeout_after_15000ms",
  });

  await service.executePendingBatch({ batchSize: 10 });

  assert.deepEqual(updates, [
    {
      id: 7255,
      status: "retry_pending",
      error: "timeout_after_15000ms",
      maxRetryAttempts: 5,
      retryBaseDelayMs: 250,
    },
  ]);
});

test("cTrader: executePendingBatch still marks permanent failures as failed", async () => {
  const service = new CTraderService({
    baseUrl: "http://fake-gw",
    timeoutMs: 1000,
    maxRetryAttempts: 5,
    retryBaseDelayMs: 250,
  });

  let updates: any[] = [];

  (service as any).isHealthy = async () => true;
  (service as any).db = {
    async claimPendingTrades() {
      return [{ id: 7260 }];
    },
    async updateTradeStatus(payload: any[]) {
      updates = payload;
    },
  };
  (service as any).exectuteTradeSignalApiCall = async () => ({
    ok: false,
    error: "invalid_tradingAccountId_in_signal_data",
  });

  await service.executePendingBatch({ batchSize: 10 });

  assert.deepEqual(updates, [
    {
      id: 7260,
      status: "failed",
      error: "invalid_tradingAccountId_in_signal_data",
    },
  ]);
});
