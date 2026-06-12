import test from "node:test";
import assert from "node:assert/strict";

import { Mt5ListenerDBServices } from "../../app/mt5Listener/mt5Listener.db";
import { Mt5ListenerServices } from "../../app/mt5Listener/mt5Listener.services";

test("MT5: returns normalized signal and marks in-progress", async () => {
  let markedInProgress = false;

  const service = new Mt5ListenerServices({
    async getNextPendingJob() {
      return {
        id: 101,
        action: "BUY",
        symbol: "EURUSD",
        volume: 0.2,
        status: { id: 88 },
      } as any;
    },
    async markJobInProgress() {
      markedInProgress = true;
    },
    async markJobFailed() {
      throw new Error("should_not_fail");
    },
    async markJobSuccess() {
      throw new Error("not_used");
    },
  } as any);

  const signal = await service.getSignalForEA("acct-1");

  assert.equal(markedInProgress, true);
  assert.deepEqual(signal, {
    ackId: 101,
    side: "buy",
    symbol: "EURUSD",
    qty: 0.2,
    executionMode: "OPEN",
    orderType: "MARKET",
  });
});

test("MT5: invalid volume is marked failed and returns empty", async () => {
  let failedReason = "";

  const fakeJob = {
    id: 102,
    action: "SELL",
    symbol: "XAUUSD",
    volume: 0,
    status: { id: 89 },
  } as any;

  const service = new Mt5ListenerServices({
    async getNextPendingJob() {
      return fakeJob;
    },
    async markJobInProgress() {
      return;
    },
    async markJobFailed(_: any, reason: string) {
      failedReason = reason;
    },
    async markJobSuccess() {
      throw new Error("not_used");
    },
  } as any);

  const signal = await service.getSignalForEA("acct-2");

  assert.deepEqual(signal, {});
  assert.equal(failedReason, "Invalid volume");
});

test("MT5: maps SL/TP distances from stored symbol metadata before returning payload", async () => {
  const service = new Mt5ListenerServices({
    async getNextPendingJob() {
      return {
        id: 103,
        action: "BUY",
        symbol: "EURUSD",
        volume: 0.3,
        executionMode: "OPEN",
        stopLossDistance: 10,
        takeProfitDistance: 20,
        status: { id: 90 },
      } as any;
    },
    async getMt5SymbolMeta() {
      return {
        digits: 5,
        point: "0.00001",
        tickSize: "0.00001",
        pipSize: null,
      };
    },
    async markJobInProgress() {
      return;
    },
    async markJobFailed() {
      throw new Error("should_not_fail");
    },
  } as any);

  const signal = await service.getSignalForEA("acct-3");

  assert.deepEqual(signal, {
    ackId: 103,
    side: "buy",
    symbol: "EURUSD",
    qty: 0.3,
    executionMode: "OPEN",
    orderType: "MARKET",
    stopLossDistance: 0.001,
    takeProfitDistance: 0.002,
  });
});

test("MT5: forwards limit and stop order fields to the EA", async () => {
  const jobs = [
    {
      id: 106,
      action: "BUY",
      symbol: "EURUSD",
      volume: 0.2,
      orderType: "LIMIT",
      limitPrice: "1.085",
      stopLoss: "1.08",
      takeProfit: "1.095",
      status: { id: 93 },
    },
    {
      id: 107,
      action: "SELL",
      symbol: "EURUSD",
      volume: 0.3,
      orderType: "STOP",
      stopPrice: "1.075",
      status: { id: 94 },
    },
  ] as any[];

  const service = new Mt5ListenerServices({
    async getNextPendingJob() {
      return jobs.shift() ?? null;
    },
    async markJobInProgress() {
      return;
    },
    async markJobFailed() {
      throw new Error("should_not_fail");
    },
  } as any);

  const limit = await service.getSignalForEA("acct-orders");
  const stop = await service.getSignalForEA("acct-orders");

  assert.deepEqual(limit, {
    ackId: 106,
    side: "buy",
    symbol: "EURUSD",
    qty: 0.2,
    executionMode: "OPEN",
    orderType: "LIMIT",
    limitPrice: 1.085,
    stopLoss: 1.08,
    takeProfit: 1.095,
  });
  assert.deepEqual(stop, {
    ackId: 107,
    side: "sell",
    symbol: "EURUSD",
    qty: 0.3,
    executionMode: "OPEN",
    orderType: "STOP",
    stopPrice: 1.075,
  });
});

test("MT5: forwards unsupported order types so the EA can ACK a clear rejection", async () => {
  const service = new Mt5ListenerServices({
    async getNextPendingJob() {
      return {
        id: 108,
        action: "BUY",
        symbol: "EURUSD",
        volume: 0.1,
        orderType: "STOP_LIMIT",
        stopPrice: 1.09,
        limitPrice: 1.088,
        status: { id: 95 },
      } as any;
    },
    async markJobInProgress() {
      return;
    },
    async markJobFailed() {
      throw new Error("should_not_fail");
    },
  } as any);

  const signal = await service.getSignalForEA("acct-unsupported");

  assert.equal((signal as any).orderType, "STOP_LIMIT");
  assert.equal((signal as any).stopPrice, 1.09);
  assert.equal((signal as any).limitPrice, 1.088);
});

test("MT5: close payload resolves ticket from broker position, broker order, then legacy order id", async () => {
  const jobs = [
    {
      id: 109,
      symbol: "EURUSD",
      orderId: 7001,
      brokerOrderId: "8001",
      brokerPositionId: "9001",
      status: { id: 96, status: "pending_close" },
    },
    {
      id: 110,
      symbol: "EURUSD",
      orderId: 7002,
      brokerOrderId: "8002",
      brokerPositionId: null,
      status: { id: 97, status: "pending_close" },
    },
    {
      id: 111,
      symbol: "EURUSD",
      orderId: 7003,
      brokerOrderId: null,
      brokerPositionId: null,
      status: { id: 98, status: "pending_close" },
    },
  ] as any[];

  const service = new Mt5ListenerServices({
    async getNextPendingJob() {
      return jobs.shift() ?? null;
    },
    async markJobInProgress() {
      return;
    },
  } as any);

  assert.deepEqual(await service.getSignalForEA("acct-close"), {
    ackId: 109,
    executionMode: "CLOSE",
    side: "close",
    symbol: "EURUSD",
    brokerOrderId: "8001",
    brokerPositionId: "9001",
    orderId: "7001",
    ticket: "9001",
  });
  assert.deepEqual(await service.getSignalForEA("acct-close"), {
    ackId: 110,
    executionMode: "CLOSE",
    side: "close",
    symbol: "EURUSD",
    brokerOrderId: "8002",
    orderId: "7002",
    ticket: "8002",
  });
  assert.deepEqual(await service.getSignalForEA("acct-close"), {
    ackId: 111,
    executionMode: "CLOSE",
    side: "close",
    symbol: "EURUSD",
    orderId: "7003",
    ticket: "7003",
  });
});

test("MT5: falls back to app mapping when symbol metadata is missing", async () => {
  const service = new Mt5ListenerServices({
    async getNextPendingJob() {
      return {
        id: 104,
        action: "SELL",
        symbol: "XAUUSD",
        volume: 0.1,
        stopLossDistance: 10,
        status: { id: 91 },
      } as any;
    },
    async getMt5SymbolMeta() {
      return null;
    },
    async markJobInProgress() {
      return;
    },
    async markJobFailed() {
      throw new Error("should_not_fail");
    },
  } as any);

  const signal = await service.getSignalForEA("acct-4");

  assert.deepEqual(signal, {
    ackId: 104,
    side: "sell",
    symbol: "XAUUSD",
    qty: 0.1,
    executionMode: "OPEN",
    orderType: "MARKET",
    stopLossDistance: 1,
  });
});

test("MT5: unmapped distance symbols are rejected and marked failed", async () => {
  let failedReason = "";

  const service = new Mt5ListenerServices({
    async getNextPendingJob() {
      return {
        id: 105,
        action: "BUY",
        symbol: "FOOBAR",
        volume: 0.1,
        stopLossDistance: 10,
        status: { id: 92 },
      } as any;
    },
    async getMt5SymbolMeta() {
      return null;
    },
    async markJobInProgress() {
      return;
    },
    async markJobFailed(_: any, reason: string) {
      failedReason = reason;
    },
  } as any);

  const signal = await service.getSignalForEA("acct-5");

  assert.deepEqual(signal, {});
  assert.equal(failedReason, "distance_mapping_unavailable");
});

test("MT5: handleState replaces persisted symbol specs", async () => {
  let capturedAccountId = "";
  let capturedItems: any[] = [];

  const service = new Mt5ListenerServices({
    async replaceMt5Symbols(brokerAccountId: string, items: any[]) {
      capturedAccountId = brokerAccountId;
      capturedItems = items;
    },
  } as any);

  const result = await service.handleState("acct-6", {
    items: [
      {
        symbol: "EURUSD",
        digits: 5,
        point: 0.00001,
        tickSize: 0.00001,
      },
    ],
  });

  assert.deepEqual(result, {
    ok: true,
    brokerAccountId: "acct-6",
    count: 1,
  });
  assert.equal(capturedAccountId, "acct-6");
  assert.deepEqual(capturedItems, [
    {
      symbol: "EURUSD",
      digits: 5,
      point: 0.00001,
      tickSize: 0.00001,
      pipSize: null,
    },
  ]);
});

test("MT5: handleState ignores position-only diagnostics without clearing symbol specs", async () => {
  let replaceCalled = false;

  const service = new Mt5ListenerServices({
    async replaceMt5Symbols() {
      replaceCalled = true;
    },
  } as any);

  const result = await service.handleState("", {
    account_login: 123456,
    positions: [{ ticket: 1, symbol: "EURUSD" }],
  });

  assert.deepEqual(result, {
    ok: true,
    brokerAccountId: "123456",
    count: 0,
    symbolsUpdated: false,
  });
  assert.equal(replaceCalled, false);
});

test("MT5: handleAck persists broker refs, closes close ACKs, and records failures", async () => {
  const marked: Array<{
    type: "success" | "close-success" | "failed";
    jobId: number;
    refs?: any;
    reason?: string;
  }> = [];

  const service = new Mt5ListenerServices({
    async getNextPendingJob() {
      return null;
    },
    async getJobBySignalId(ackId: number) {
      return {
        id: ackId,
        status: { id: ackId + 100, status: "in_progress" },
      } as any;
    },
    async markJobInProgress() {
      return;
    },
    async markJobSuccess(job: any, refs?: any) {
      marked.push({ type: "success", jobId: job.id, refs });
    },
    async markJobFailed(job: any, reason: string) {
      marked.push({ type: "failed", jobId: job.id, reason });
    },
    async markJobCloseSuccess(job: any, refs?: any) {
      marked.push({ type: "close-success", jobId: job.id, refs });
    },
  } as any);

  await service.handleAck({
    ackId: 201,
    status: "success",
    orderId: "7001",
    brokerOrderId: "8001",
    brokerPositionId: "9001",
  });
  await service.handleAck({
    ackId: 202,
    status: "success",
    executionMode: "CLOSE",
    ticket: "9002",
    brokerPositionId: "9002",
  });
  await service.handleAck({ ackId: 203, status: "failed", message: "broker_rejected" });

  assert.deepEqual(marked, [
    {
      type: "success",
      jobId: 201,
      refs: {
        orderId: "7001",
        brokerOrderId: "8001",
        brokerPositionId: "9001",
      },
    },
    {
      type: "close-success",
      jobId: 202,
      refs: {
        orderId: "9002",
        brokerPositionId: "9002",
      },
    },
    { type: "failed", jobId: 203, reason: "broker_rejected" },
  ]);
});

test("MT5 DB: success persists broker refs and failures write last_error", async () => {
  const queries: Array<{ sql: string; params: any[] }> = [];
  const manager = {
    async query(sql: string, params: any[]) {
      queries.push({ sql, params });
    },
  };
  const db = new Mt5ListenerDBServices({
    getRepository() {
      return {};
    },
    manager,
    async transaction(callback: any) {
      await callback(manager);
    },
  } as any);

  await db.markJobSuccess(
    { id: 301, status: { id: 401 } } as any,
    { orderId: "7001", brokerOrderId: "8001", brokerPositionId: "9001" },
  );
  await db.markJobFailed({ id: 302, status: { id: 402 } } as any, "broker_rejected");

  assert.equal(queries.length, 3);
  assert.match(queries[0].sql, /broker_order_id=COALESCE/);
  assert.deepEqual(queries[0].params, [301, "7001", "8001", "9001"]);
  assert.match(queries[1].sql, /status='completed'/);
  assert.deepEqual(queries[1].params, [401]);
  assert.match(queries[2].sql, /last_error=\$2/);
  assert.deepEqual(queries[2].params, [402, "broker_rejected"]);
});
