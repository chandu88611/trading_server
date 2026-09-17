import assert from "node:assert/strict";
import test from "node:test";
import { calculateAccountRiskMetrics, evaluateRisk } from "../../app/trade/services/tradeGuard.service";

const now = new Date("2026-09-16T08:00:00Z");
const rules = { isEnabled: true, dailyLossLimit: 10, dailyProfitTarget: 50,
  cooldownAfterLossMins: 5, configuration: { maxConsecutiveLosses: 3 } };

test("empty and legacy fill histories start at zero without blocking entries", () => {
  for (const records of [[], [{ status: "completed", brokerOrderId: "legacy" }], [{ status: "closed", fillHistory: [] }]]) {
    const metrics = calculateAccountRiskMetrics(records, now);
    assert.equal(metrics?.dailyPnl, 0);
    assert.equal(metrics?.drawdownPct, 0);
    assert.equal(metrics?.consecutiveLosses, 0);
    assert.equal(evaluateRisk({ ...rules, configuration: { ...rules.configuration, maxDrawdownPct: 5 } }, { metrics }, "CRYPTO", { volume: 0.01 }, now).allowed, true);
  }
});

test("missing histories do not hide recorded daily losses", () => {
  const metrics = calculateAccountRiskMetrics([
    { symbol: "BTCINR", status: "completed", brokerOrderId: "legacy" },
    { symbol: "BTCINR", fillHistory: [
      { id: "buy", executedAt: "2026-09-16T06:00:00Z", side: "BUY", price: 100, quantity: 1, fee: 0, currency: "INR" },
      { id: "sell", executedAt: "2026-09-16T07:00:00Z", side: "SELL", price: 90, quantity: 1, fee: 0, currency: "INR" },
    ] },
  ], now, 1000);
  assert.equal(metrics?.dailyPnl, -10);
  assert.equal(metrics?.consecutiveLosses, 1);
  assert.equal(evaluateRisk(rules, { metrics }, "CRYPTO", {}, now).reason, "daily_loss_limit");
});

test("previous-day fills do not count toward today's realized P&L", () => {
  const metrics = calculateAccountRiskMetrics([{ symbol: "BTCINR", fillHistory: [
    { id: "old", executedAt: "2026-09-15T07:00:00Z", side: "BUY", price: 100, quantity: 1, fee: 2, currency: "INR" },
  ] }], now);
  assert.equal(metrics?.dailyPnl, 0);
  assert.equal(evaluateRisk(rules, { metrics }, "CRYPTO", {}, now).allowed, true);
});

test("malformed recorded fills still fail validation", () => {
  assert.equal(calculateAccountRiskMetrics([{ fillHistory: [{ id: "bad", executedAt: "invalid" }] }], now), null);
});
