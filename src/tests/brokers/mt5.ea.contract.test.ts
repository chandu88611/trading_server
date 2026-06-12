import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const eaPath = path.resolve(__dirname, "../../../experts/mt5/SignalPollerEA.mq5");

function readEa() {
  return fs.readFileSync(eaPath, "utf8");
}

test("MT5 EA contract: versioned file exposes required inputs and endpoints", () => {
  const source = readEa();

  assert.match(source, /input string SignalUrl/);
  assert.match(source, /input string AckUrl/);
  assert.match(source, /input string StateUrl/);
  assert.match(source, /input long MagicNumber/);
  assert.match(source, /input int MaxDeviationPoints/);
  assert.match(source, /input int HttpTimeoutMs/);
  assert.match(source, /input string ExtraSymbolsCsv/);
});

test("MT5 EA contract: ACK payload sends broker refs and close identity", () => {
  const source = readEa();

  for (const token of [
    '\\"ackId\\"',
    '\\"status\\"',
    '\\"ticket\\"',
    '\\"orderId\\"',
    '\\"brokerOrderId\\"',
    '\\"brokerPositionId\\"',
    '\\"positionTicket\\"',
    '\\"dealId\\"',
    '\\"executionMode\\"',
    '\\"side\\"',
  ]) {
    assert.ok(source.includes(token), `missing ${token}`);
  }
});

test("MT5 EA contract: supports core order types and rejects unsupported ones", () => {
  const source = readEa();

  assert.match(source, /trade\.Buy\(/);
  assert.match(source, /trade\.Sell\(/);
  assert.match(source, /trade\.BuyLimit\(/);
  assert.match(source, /trade\.SellLimit\(/);
  assert.match(source, /trade\.BuyStop\(/);
  assert.match(source, /trade\.SellStop\(/);
  assert.ok(source.includes("STOP_LIMIT"));
  assert.ok(source.includes("MARKET_RANGE"));
  assert.ok(source.includes("unsupported_order_type_for_mt5_ea"));
});

test("MT5 EA contract: syncs symbol specs and avoids unsafe hedging closes", () => {
  const source = readEa();

  assert.ok(source.includes('\\"items\\"'));
  assert.ok(source.includes('\\"symbolSpecs\\"'));
  assert.ok(source.includes('\\"positions\\"'));
  assert.ok(source.includes("GlobalVariableSet"));
  assert.ok(source.includes("ACCOUNT_MARGIN_MODE_RETAIL_HEDGING"));
  assert.ok(source.includes("multiple hedging positions"));
});
