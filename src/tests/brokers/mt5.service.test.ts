import test from "node:test";
import assert from "node:assert/strict";

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

test("MT5: handleAck success and failure branches", async () => {
  const marked: Array<{ type: "success" | "failed"; ackId: any; reason?: string }> = [];

  const service = new Mt5ListenerServices({
    async getNextPendingJob() {
      return null;
    },
    async markJobInProgress() {
      return;
    },
    async markJobSuccess(ackId: any) {
      marked.push({ type: "success", ackId });
    },
    async markJobFailed(ackId: any, reason: string) {
      marked.push({ type: "failed", ackId, reason });
    },
  } as any);

  await service.handleAck({ ackId: 201, status: "success" });
  await service.handleAck({ ackId: 202, status: "failed", message: "broker_rejected" });

  assert.deepEqual(marked, [
    { type: "success", ackId: 201 },
    { type: "failed", ackId: 202, reason: "broker_rejected" },
  ]);
});
