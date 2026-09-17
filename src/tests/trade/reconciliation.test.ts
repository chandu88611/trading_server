import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFill } from "../../app/trade/services/reconciliation.service";
test("reconciliation normalizes actual fills without inventing fees", () => {
  const fill = normalizeFill({ orderId: "order", exchangeTradeId: "fill", tradingSymbol: "ABC", transactionType: "BUY", tradedPrice: 100, tradedQuantity: 3, exchangeTime: "2026-09-17 09:30:00" }, "DHAN");
  assert.equal(fill.quantity, 3); assert.equal(fill.fee, null);
  assert.equal(fill.timestamp.toISOString(), "2026-09-17T04:00:00.000Z");
});
test("CoinDCX futures fills use repeatable natural IDs when exchange omits fill ID", () => {
  const raw = { order_id: "order", pair: "B-BTC_USDT", timestamp: 1705645534425.8374, quantity: 0.001, price: 50000, side: "buy", fee_amount: 0.1 };
  assert.equal(normalizeFill(raw,"COINDCX").id, normalizeFill({...raw},"COINDCX").id);
  assert.equal(normalizeFill(raw,"COINDCX").currency,"USDT");
  assert.throws(() => normalizeFill({ ...raw, quantity: 0 },"COINDCX"));
});
