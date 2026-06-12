import test from "node:test";
import assert from "node:assert/strict";

import AppDataSource from "../../db/data-source";
import { ZebuService } from "../../app/zebu/services/zebu.service";
import { ZebuDB } from "../../app/zebu/services/zebu.db";
import { TradingAccountStatus } from "../../app/subscriptionPlan/enums/subscriberPlan.enum";

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

function decodeNorenBody(body: any) {
  const params = new URLSearchParams(String(body));
  const jDataRaw = params.get("jData");
  assert.ok(jDataRaw, "jData missing");
  return {
    jData: JSON.parse(jDataRaw),
    jKey: params.get("jKey"),
  };
}

function fakeAccount(overrides: Record<string, any> = {}): any {
  return {
    id: 55,
    userId: 20,
    status: TradingAccountStatus.PENDING,
    accountId: "ZCID1",
    accessToken: "zebu-token-123",
    accountMeta: {
      zebu: {
        uid: "ZCID1",
        actid: "ZCID1",
        clientId: "ZCID1",
        apiKey: "zkey-1",
        apiSecret: "zsecret-1",
        baseUrl: "https://zebu.mock/NorenWClientTP",
      },
    },
    ...overrides,
  };
}

function serviceWithAccount(account: any, extraDb: Record<string, any> = {}) {
  const service = new ZebuService();
  (service as any).db = {
    async getTradingAccountById() {
      return account;
    },
    async updateAccountMeta() {
      return;
    },
    ...extraDb,
  };
  return service;
}

test("Zebu: generate token with factor2 and persist MYNT metadata", async () => {
  const originalFetch = global.fetch;
  const fetchCalls: Array<{ input: any; init?: any }> = [];
  const persisted: any[] = [];
  const account = fakeAccount();

  global.fetch = (async (input: any, init?: any) => {
    fetchCalls.push({ input, init });
    return new Response(
      JSON.stringify({
        stat: "Ok",
        susertoken: "zebu-token-generated",
        exarr: ["NSE", "BSE"],
        prarr: ["C", "I"],
        orarr: ["MKT", "LMT"],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  }) as any;

  const service = serviceWithAccount(account, {
    async updateAccountMeta(savedAccount: any, nextMeta: any) {
      persisted.push({ savedAccount, nextMeta });
    },
  });

  try {
    const result = await service.generateAndSaveTokenUsingTotp({
      userId: 20,
      tradingAccountId: 55,
      password: "myPass",
      factor2: "654321",
    });

    const { jData } = decodeNorenBody(fetchCalls[0].init.body);
    assert.equal(fetchCalls[0].input, "https://zebu.mock/NorenWClientTP/QuickAuth");
    assert.equal(jData.uid, "ZCID1");
    assert.equal(jData.factor2, "654321");
    assert.equal(jData.pwd.length, 64);
    assert.equal(result.ok, true);
    assert.equal(result.tokenStored, true);
    assert.equal(account.status, TradingAccountStatus.VERIFIED);
    assert.equal(account.accessToken, "zebu-token-generated");
    assert.ok((account as any).lastVerifiedAt instanceof Date);
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].nextMeta.zebu.accessToken, "zebu-token-generated");
    assert.deepEqual(persisted[0].nextMeta.zebu.exarr, ["NSE", "BSE"]);
    assert.deepEqual(persisted[0].nextMeta.zebu.prarr, ["C", "I"]);
    assert.deepEqual(persisted[0].nextMeta.zebu.orarr, ["MKT", "LMT"]);
    assert.ok(persisted[0].nextMeta.zebu.lastVerifiedAt);
  } finally {
    global.fetch = originalFetch;
  }
});

test("Zebu: generate token accepts totp alias for factor2", async () => {
  const originalFetch = global.fetch;
  let capturedFactor2 = "";

  global.fetch = (async (_input: any, init?: any) => {
    capturedFactor2 = decodeNorenBody(init.body).jData.factor2;
    return new Response(JSON.stringify({ stat: "Ok", susertoken: "zebu-token-123" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as any;

  const service = serviceWithAccount(fakeAccount());

  try {
    await service.generateAndSaveTokenUsingTotp({
      userId: 20,
      tradingAccountId: 55,
      password: "myPass",
      totp: "111222",
    });

    assert.equal(capturedFactor2, "111222");
  } finally {
    global.fetch = originalFetch;
  }
});

test("Zebu: manual token save stores uid, actid, default base URL, and verification time", async () => {
  const persisted: any[] = [];
  const account = fakeAccount({
    status: TradingAccountStatus.PENDING,
    accessToken: "",
    accountMeta: { zebu: {} },
  });

  const service = serviceWithAccount(account, {
    async updateAccountMeta(savedAccount: any, nextMeta: any) {
      persisted.push({ savedAccount, nextMeta });
    },
  });

  const result = await service.saveAuthToken({
    userId: 20,
    tradingAccountId: 55,
    accessToken: "manual-token",
    uid: "zcid-2",
    actid: "zcid-2",
  });

  assert.equal(result.ok, true);
  assert.equal(account.status, TradingAccountStatus.VERIFIED);
  assert.equal(account.accessToken, "manual-token");
  assert.ok((account as any).lastVerifiedAt instanceof Date);
  assert.equal(persisted[0].nextMeta.zebu.baseUrl, "https://go.mynt.in/NorenWClientTP");
  assert.equal(persisted[0].nextMeta.zebu.uid, "ZCID2");
  assert.equal(persisted[0].nextMeta.zebu.actid, "ZCID2");
});

test("Zebu: missing broker credentials throws controlled error", async () => {
  const service = serviceWithAccount({
    id: 56,
    userId: 21,
    status: TradingAccountStatus.PENDING,
    accountMeta: { zebu: { baseUrl: "https://zebu.mock/NorenWClientTP" } },
  });

  await assert.rejects(
    () =>
      service.generateAndSaveTokenUsingTotp({
        userId: 21,
        tradingAccountId: 56,
        password: "myPass",
        factor2: "654321",
      }),
    (err: any) => {
      assert.equal(err?.message, "zebu_credentials_missing");
      return true;
    }
  );
});

test("Zebu: expired upstream session throws zebu_session_expired", async () => {
  const originalFetch = global.fetch;
  global.fetch = (async () =>
    new Response(JSON.stringify({ stat: "Not_Ok", emsg: "Session Expired : Invalid Session Key" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as any;

  const service = serviceWithAccount(fakeAccount());

  try {
    await assert.rejects(
      () => service.getOrders(20, 55),
      (err: any) => {
        assert.equal(err?.message, "zebu_session_expired");
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("Zebu: malformed upstream response throws controlled error", async () => {
  const originalFetch = global.fetch;
  global.fetch = (async () =>
    new Response("not-json", {
      status: 200,
      headers: { "content-type": "text/plain" },
    })) as any;

  const service = serviceWithAccount(fakeAccount());

  try {
    await assert.rejects(
      () => service.getPositions(20, 55),
      (err: any) => {
        assert.equal(err?.message, "zebu_malformed_upstream_response");
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("Zebu: order type mapping covers MARKET, LIMIT, STOP, SL-LMT, and SL-MKT", async () => {
  const originalFetch = global.fetch;
  const captured: string[] = [];

  global.fetch = (async (_input: any, init?: any) => {
    captured.push(decodeNorenBody(init.body).jData.prctyp);
    return new Response(JSON.stringify({ stat: "Ok", norenordno: `N${captured.length}` }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as any;

  const service = serviceWithAccount(fakeAccount({ status: TradingAccountStatus.VERIFIED }));

  try {
    for (const orderType of ["MARKET", "LIMIT", "STOP", "STOP_LIMIT", "SL-LMT", "SL-MKT"]) {
      await service.placeOrder({
        userId: 20,
        tradingAccountId: 55,
        order: {
          symbol: "RELIANCE",
          exchange: "NSE",
          side: "BUY",
          quantity: 1,
          orderType,
          price: ["MARKET", "STOP", "SL-MKT"].includes(orderType) ? undefined : 100,
          triggerPrice: ["STOP", "STOP_LIMIT", "SL-LMT", "SL-MKT"].includes(orderType) ? 99 : undefined,
        },
      });
    }

    assert.deepEqual(captured, ["MKT", "LMT", "SL-MKT", "SL-LMT", "SL-LMT", "SL-MKT"]);
  } finally {
    global.fetch = originalFetch;
  }
});

test("Zebu: place order sends jData plus jKey and returns norenordno", async () => {
  const originalFetch = global.fetch;
  let captured: ReturnType<typeof decodeNorenBody> | null = null;

  global.fetch = (async (input: any, init?: any) => {
    assert.equal(input, "https://zebu.mock/NorenWClientTP/PlaceOrder");
    captured = decodeNorenBody(init.body);
    return new Response(JSON.stringify({ stat: "Ok", norenordno: "2401010001" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as any;

  const service = serviceWithAccount(fakeAccount({ status: TradingAccountStatus.VERIFIED }));

  try {
    const result = await service.placeOrder({
      userId: 20,
      tradingAccountId: 55,
      order: {
        symbol: "RELIANCE",
        exchange: "NSE",
        side: "SELL",
        quantity: 2,
        orderType: "LIMIT",
        product: "MIS",
        price: 101.5,
        clientOrderId: "client-tag-1234567890-extra",
      },
    });

    assert.equal(result.orderId, "2401010001");
    const seen = captured as ReturnType<typeof decodeNorenBody> | null;
    assert.ok(seen);
    assert.equal(seen.jKey, "zebu-token-123");
    assert.equal(seen.jData.uid, "ZCID1");
    assert.equal(seen.jData.actid, "ZCID1");
    assert.equal(seen.jData.exch, "NSE");
    assert.equal(seen.jData.tsym, "RELIANCE-EQ");
    assert.equal(seen.jData.trantype, "S");
    assert.equal(seen.jData.prd, "I");
    assert.equal(seen.jData.prc, "101.5");
    assert.equal(seen.jData.remarks, "client-tag-123456789");
  } finally {
    global.fetch = originalFetch;
  }
});

test("Zebu: modify order resolves missing fields from OrderBook", async () => {
  const originalFetch = global.fetch;
  const actions: string[] = [];
  let modifyPayload: any = null;

  global.fetch = (async (input: any, init?: any) => {
    actions.push(String(input).split("/").pop() ?? "");
    const decoded = decodeNorenBody(init.body);

    if (String(input).endsWith("/OrderBook")) {
      return new Response(
        JSON.stringify([
          {
            norenordno: "ORD1",
            exch: "NSE",
            tsym: "INFY-EQ",
            prctyp: "LMT",
            prd: "C",
            ret: "DAY",
            qty: "4",
            prc: "1500",
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    modifyPayload = decoded.jData;
    return new Response(JSON.stringify({ stat: "Ok", result: "ORD1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as any;

  const service = serviceWithAccount(fakeAccount({ status: TradingAccountStatus.VERIFIED }));

  try {
    const result = await service.modifyOrder({
      userId: 20,
      tradingAccountId: 55,
      orderId: "ORD1",
      price: 1501,
    });

    assert.equal(result.orderId, "ORD1");
    assert.deepEqual(actions, ["OrderBook", "ModifyOrder"]);
    assert.equal(modifyPayload.exch, "NSE");
    assert.equal(modifyPayload.tsym, "INFY-EQ");
    assert.equal(modifyPayload.prctyp, "LMT");
    assert.equal(modifyPayload.prc, "1501");
    assert.equal(modifyPayload.qty, "4");
  } finally {
    global.fetch = originalFetch;
  }
});

test("Zebu: cancel order sends noren order number", async () => {
  const originalFetch = global.fetch;
  let captured: any = null;

  global.fetch = (async (_input: any, init?: any) => {
    captured = decodeNorenBody(init.body).jData;
    return new Response(JSON.stringify({ stat: "Ok", result: "ORD2" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as any;

  const service = serviceWithAccount(fakeAccount({ status: TradingAccountStatus.VERIFIED }));

  try {
    const result = await service.cancelOrder({
      userId: 20,
      tradingAccountId: 55,
      orderId: "ORD2",
    });

    assert.equal(result.orderId, "ORD2");
    assert.equal(captured.norenordno, "ORD2");
    assert.equal(captured.uid, "ZCID1");
  } finally {
    global.fetch = originalFetch;
  }
});

test("Zebu: reads call OrderBook, PositionBook, and Holdings", async () => {
  const originalFetch = global.fetch;
  const actions: string[] = [];

  global.fetch = (async (input: any) => {
    actions.push(String(input).split("/").pop() ?? "");
    return new Response(JSON.stringify([{ ok: true }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as any;

  const service = serviceWithAccount(fakeAccount({ status: TradingAccountStatus.VERIFIED }));

  try {
    await service.getOrders(20, 55);
    await service.getPositions(20, 55);
    await service.getHoldings(20, 55);

    assert.deepEqual(actions, ["OrderBook", "PositionBook", "Holdings"]);
  } finally {
    global.fetch = originalFetch;
  }
});

test("Zebu: executePendingBatch persists brokerOrderId on success", async () => {
  const originalFetch = global.fetch;
  const updates: any[] = [];

  global.fetch = (async () =>
    new Response(JSON.stringify({ stat: "Ok", norenordno: "EXEC123" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as any;

  const service = new ZebuService();
  (service as any).db = {
    async claimPendingTrades() {
      return [
        {
          id: 901,
          userId: 20,
          action: "BUY",
          symbol: "RELIANCE",
          exchange: "NSE",
          volume: 1,
          orderType: "LIMIT",
          limitPrice: 100,
          price: 100,
          tradingAccount: fakeAccount({ status: TradingAccountStatus.VERIFIED }),
        },
      ];
    },
    async updateTradeStatus(items: any[]) {
      updates.push(...items);
    },
  };

  try {
    const result = await service.executePendingBatch({ batchSize: 1 });

    assert.equal(result.processed, 1);
    assert.equal(result.executed, 1);
    assert.equal(updates[0].status, "executed");
    assert.equal(updates[0].brokerOrderId, "EXEC123");
  } finally {
    global.fetch = originalFetch;
  }
});

test("Zebu: executePendingBatch records failed status and error", async () => {
  const originalFetch = global.fetch;
  const updates: any[] = [];

  global.fetch = (async () =>
    new Response(JSON.stringify({ stat: "Not_Ok", emsg: "Invalid Trading Symbol" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as any;

  const service = new ZebuService();
  (service as any).db = {
    async claimPendingTrades() {
      return [
        {
          id: 902,
          userId: 20,
          action: "BUY",
          symbol: "BADSYM",
          exchange: "NSE",
          volume: 1,
          tradingAccount: fakeAccount({ status: TradingAccountStatus.VERIFIED }),
        },
      ];
    },
    async updateTradeStatus(items: any[]) {
      updates.push(...items);
    },
  };

  try {
    const result = await service.executePendingBatch({ batchSize: 1 });

    assert.equal(result.processed, 1);
    assert.equal(result.failed, 1);
    assert.equal(updates[0].status, "failed");
    assert.equal(updates[0].error, "zebu_upstream_failed");
  } finally {
    global.fetch = originalFetch;
  }
});

test("Zebu: protected entry creates monitor and keeps signal in progress", async () => {
  const originalFetch = global.fetch;
  const updates: any[] = [];
  const monitors: any[] = [];

  global.fetch = (async () =>
    new Response(JSON.stringify({ stat: "Ok", norenordno: "ENTRY123" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as any;

  const service = new ZebuService();
  (service as any).db = {
    async claimPendingTrades() {
      return [
        {
          id: 903,
          userId: 20,
          tradingAccountId: 55,
          action: "BUY",
          symbol: "RELIANCE",
          exchange: "NSE",
          volume: 1,
          orderType: "MARKET",
          price: 100,
          entryRef: "zebu-protected-1",
          stopLossDistance: 70,
          takeProfitDistance: 170,
          breakEvenActivationDistance: 100,
          breakEvenOffsetDistance: 2,
          trailingStopLossDistance: 100,
          tradingAccount: fakeAccount({ status: TradingAccountStatus.VERIFIED }),
        },
      ];
    },
    async createProtectionMonitor(payload: any) {
      monitors.push(payload);
      return payload;
    },
    async updateTradeStatus(items: any[]) {
      updates.push(...items);
    },
  };

  try {
    const result = await service.executePendingBatch({ batchSize: 1 });

    assert.equal(result.processed, 1);
    assert.equal(monitors.length, 1);
    assert.equal(monitors[0].entryOrderId, "ENTRY123");
    assert.equal(monitors[0].stopLossDistance, 70);
    assert.equal(monitors[0].takeProfitDistance, 170);
    assert.equal(monitors[0].monitorStatus, "pending_fill");
    assert.equal(updates[0].status, "in_progress");
    assert.equal(updates[0].brokerOrderId, "ENTRY123");
  } finally {
    global.fetch = originalFetch;
  }
});

test("Zebu: pending fill creates target limit and SL-MKT child orders", async () => {
  const originalFetch = global.fetch;
  const actions: string[] = [];
  const placePayloads: any[] = [];
  const monitorPatches: any[] = [];
  const statusUpdates: any[] = [];

  global.fetch = (async (input: any, init?: any) => {
    const action = String(input).split("/").pop() ?? "";
    actions.push(action);
    const decoded = decodeNorenBody(init.body);

    if (action === "OrderBook") {
      return new Response(
        JSON.stringify([
          {
            norenordno: "ENTRY1",
            status: "COMPLETE",
            avgprc: "100",
            fillshares: "1",
            qty: "1",
            token: "2885",
            ti: "0.05",
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (action === "PlaceOrder") {
      placePayloads.push(decoded.jData);
      return new Response(
        JSON.stringify({
          stat: "Ok",
          norenordno: placePayloads.length === 1 ? "TP1" : "SL1",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    throw new Error(`unexpected action ${action}`);
  }) as any;

  const service = new ZebuService();
  (service as any).db = {
    async claimProtectionMonitors() {
      return [
        {
          id: 1,
          tradeSignalId: 903,
          userId: 20,
          tradingAccountId: 55,
          symbol: "RELIANCE-EQ",
          exchange: "NSE",
          side: "BUY",
          quantity: 1,
          entryOrderId: "ENTRY1",
          stopLossDistance: 70,
          takeProfitDistance: 170,
          monitorStatus: "pending_fill",
        },
      ];
    },
    async getTradingAccountById() {
      return fakeAccount({ status: TradingAccountStatus.VERIFIED });
    },
    async updateProtectionMonitor(_id: number, patchData: any) {
      monitorPatches.push(patchData);
    },
    async updateTradeStatus(items: any[]) {
      statusUpdates.push(...items);
    },
    async markProtectionFailed(_: any, error: string) {
      throw new Error(error);
    },
  };

  try {
    const result = await service.executeProtectionBatch({ batchSize: 1 });

    assert.equal(result.processed, 1);
    assert.deepEqual(actions, ["OrderBook", "PlaceOrder", "PlaceOrder"]);
    assert.equal(placePayloads[0].trantype, "S");
    assert.equal(placePayloads[0].prctyp, "LMT");
    assert.equal(placePayloads[0].prc, "270");
    assert.equal(placePayloads[1].trantype, "S");
    assert.equal(placePayloads[1].prctyp, "SL-MKT");
    assert.equal(placePayloads[1].trgprc, "30");
    assert.equal(monitorPatches[0].entryPrice, 100);
    assert.equal(monitorPatches[0].targetOrderId, "TP1");
    assert.equal(monitorPatches[0].stopOrderId, "SL1");
    assert.equal(monitorPatches[0].currentStopPrice, 30);
    assert.equal(monitorPatches[0].monitorStatus, "active");
    assert.deepEqual(statusUpdates, [{ id: 903, status: "completed" }]);
  } finally {
    global.fetch = originalFetch;
  }
});

test("Zebu: active monitor cancels sibling order when target fills", async () => {
  const originalFetch = global.fetch;
  const actions: string[] = [];
  const canceled: string[] = [];
  const patches: any[] = [];

  global.fetch = (async (input: any, init?: any) => {
    const action = String(input).split("/").pop() ?? "";
    actions.push(action);
    const decoded = decodeNorenBody(init.body);

    if (action === "OrderBook") {
      return new Response(
        JSON.stringify([
          { norenordno: "TP1", status: "COMPLETE", fillshares: "1", qty: "1" },
          { norenordno: "SL1", status: "OPEN", qty: "1" },
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (action === "CancelOrder") {
      canceled.push(decoded.jData.norenordno);
      return new Response(JSON.stringify({ stat: "Ok", result: decoded.jData.norenordno }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    throw new Error(`unexpected action ${action}`);
  }) as any;

  const service = new ZebuService();
  (service as any).db = {
    async claimProtectionMonitors() {
      return [
        {
          id: 2,
          tradeSignalId: 904,
          userId: 20,
          tradingAccountId: 55,
          symbol: "RELIANCE-EQ",
          exchange: "NSE",
          side: "BUY",
          quantity: 1,
          entryOrderId: "ENTRY1",
          targetOrderId: "TP1",
          stopOrderId: "SL1",
          monitorStatus: "active",
        },
      ];
    },
    async getTradingAccountById() {
      return fakeAccount({ status: TradingAccountStatus.VERIFIED });
    },
    async updateProtectionMonitor(_id: number, patchData: any) {
      patches.push(patchData);
    },
    async markProtectionFailed(_: any, error: string) {
      throw new Error(error);
    },
  };

  try {
    const result = await service.executeProtectionBatch({ batchSize: 1 });

    assert.equal(result.processed, 1);
    assert.deepEqual(actions, ["OrderBook", "CancelOrder"]);
    assert.deepEqual(canceled, ["SL1"]);
    assert.equal(patches[0].monitorStatus, "completed");
  } finally {
    global.fetch = originalFetch;
  }
});

test("Zebu: breakeven and trailing modify stop only in safer direction", async () => {
  const originalFetch = global.fetch;
  const modifyPayloads: any[] = [];
  const patches: any[] = [];

  global.fetch = (async (input: any, init?: any) => {
    const action = String(input).split("/").pop() ?? "";
    const decoded = decodeNorenBody(init.body);

    if (action === "OrderBook") {
      return new Response(JSON.stringify([{ norenordno: "SL1", status: "OPEN", qty: "1" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (action === "GetQuotes") {
      assert.equal(decoded.jData.token, "2885");
      return new Response(JSON.stringify({ stat: "Ok", lp: "220" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (action === "ModifyOrder") {
      modifyPayloads.push(decoded.jData);
      return new Response(JSON.stringify({ stat: "Ok", result: "SL1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    throw new Error(`unexpected action ${action}`);
  }) as any;

  const service = new ZebuService();
  (service as any).db = {
    async claimProtectionMonitors() {
      return [
        {
          id: 3,
          tradeSignalId: 905,
          userId: 20,
          tradingAccountId: 55,
          symbol: "RELIANCE-EQ",
          exchange: "NSE",
          side: "BUY",
          quantity: 1,
          entryOrderId: "ENTRY1",
          stopOrderId: "SL1",
          token: "2885",
          tickSize: 0.05,
          entryPrice: 100,
          currentStopPrice: 30,
          bestPrice: 100,
          breakEvenActivationDistance: 100,
          breakEvenOffsetDistance: 2,
          trailingStopLossDistance: 100,
          monitorStatus: "active",
        },
      ];
    },
    async getTradingAccountById() {
      return fakeAccount({ status: TradingAccountStatus.VERIFIED });
    },
    async updateProtectionMonitor(_id: number, patchData: any) {
      patches.push(patchData);
    },
    async markProtectionFailed(_: any, error: string) {
      throw new Error(error);
    },
  };

  try {
    const result = await service.executeProtectionBatch({ batchSize: 1 });

    assert.equal(result.processed, 1);
    assert.equal(modifyPayloads.length, 1);
    assert.equal(modifyPayloads[0].norenordno, "SL1");
    assert.equal(modifyPayloads[0].prctyp, "SL-MKT");
    assert.equal(modifyPayloads[0].trgprc, "120");
    assert.equal(patches[0].bestPrice, 220);
    assert.equal(patches[0].currentStopPrice, 120);
  } finally {
    global.fetch = originalFetch;
  }
});

test("Zebu: pending close cancels protection and closes flat positions without a new order", async () => {
  const originalFetch = global.fetch;
  const actions: string[] = [];
  const canceled: string[] = [];
  const updates: any[] = [];
  const patches: any[] = [];

  global.fetch = (async (input: any, init?: any) => {
    const action = String(input).split("/").pop() ?? "";
    actions.push(action);
    const decoded = decodeNorenBody(init.body);

    if (action === "OrderBook") {
      return new Response(
        JSON.stringify([
          { norenordno: "TP1", status: "OPEN", qty: "1" },
          { norenordno: "SL1", status: "OPEN", qty: "1" },
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (action === "CancelOrder") {
      canceled.push(decoded.jData.norenordno);
      return new Response(JSON.stringify({ stat: "Ok", result: decoded.jData.norenordno }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (action === "PositionBook") {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    throw new Error(`unexpected action ${action}`);
  }) as any;

  const service = new ZebuService();
  (service as any).db = {
    async claimPendingCloseTrades() {
      return [
        {
          id: 906,
          userId: 20,
          tradingAccountId: 55,
          action: "BUY",
          symbol: "RELIANCE",
          exchange: "NSE",
          volume: 1,
          brokerOrderId: "ENTRY1",
          tradingAccount: fakeAccount({ status: TradingAccountStatus.VERIFIED }),
        },
      ];
    },
    async findProtectionMonitorByTradeSignalId() {
      return {
        id: 4,
        tradeSignalId: 906,
        userId: 20,
        tradingAccountId: 55,
        symbol: "RELIANCE-EQ",
        exchange: "NSE",
        side: "BUY",
        quantity: 1,
        entryOrderId: "ENTRY1",
        targetOrderId: "TP1",
        stopOrderId: "SL1",
      };
    },
    async updateProtectionMonitor(_id: number, patchData: any) {
      patches.push(patchData);
    },
    async updateTradeStatus(items: any[]) {
      updates.push(...items);
    },
  };

  try {
    const result = await service.executeClosePendingBatch({ batchSize: 1 });

    assert.equal(result.closed, 1);
    assert.deepEqual(actions, ["OrderBook", "CancelOrder", "CancelOrder", "PositionBook"]);
    assert.deepEqual(canceled, ["TP1", "SL1"]);
    assert.equal(patches[0].monitorStatus, "completed");
    assert.equal(updates[0].status, "closed");
  } finally {
    global.fetch = originalFetch;
  }
});

test("ZebuDB: updateTradeStatus stores brokerOrderId and last_error", async () => {
  const queries: Array<{ sql: string; params: any[] }> = [];
  const savedJobs: any[] = [];
  const jobs = [
    { id: 1, status: { id: 11 }, brokerOrderId: null },
    { id: 2, status: { id: 12 }, brokerOrderId: null },
  ];

  const repo = {
    manager: {
      async query(sql: string, params: any[]) {
        queries.push({ sql, params });
      },
    },
    async find() {
      return jobs;
    },
    async save(job: any) {
      savedJobs.push({ ...job });
      return job;
    },
  };

  const restoreGetRepository = patch(AppDataSource, "getRepository", () => repo);

  try {
    const db = new ZebuDB();
    await db.updateTradeStatus([
      { id: 1, status: "executed", brokerOrderId: "555777" },
      { id: 2, status: "failed", error: "bad_symbol" },
    ]);

    assert.equal(savedJobs[0].brokerOrderId, "555777");
    assert.equal(queries.some((q) => q.sql.includes("last_error=NULL")), true);
    const failedQuery = queries.find((q) => q.params.includes("bad_symbol"));
    assert.ok(failedQuery);
    assert.equal(failedQuery?.params[0], 12);
    assert.equal(failedQuery?.params[1], "bad_symbol");
  } finally {
    restoreGetRepository();
  }
});

test("ZebuDB: ensureSchema creates protection monitor table", async () => {
  const queries: string[] = [];
  const repo = {};
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => repo);
  const restoreQuery = patch(AppDataSource, "query", async (sql: string) => {
    queries.push(sql);
    return [];
  });

  try {
    const db = new ZebuDB();
    await db.ensureSchema();

    assert.ok(
      queries.some((sql) => sql.includes("CREATE TABLE IF NOT EXISTS zebu_protection_monitors"))
    );
    assert.ok(
      queries.some((sql) => sql.includes("idx_zebu_protection_monitors_status_updated_at"))
    );
  } finally {
    restoreQuery();
    restoreGetRepository();
  }
});
