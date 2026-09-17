import test from "node:test";
import assert from "node:assert/strict";
import { allocateQuantity } from "../../app/trade/services/mamAllocation.service";
test("MAM allocates proportional equity and fixed multipliers", () => {
  assert.equal(allocateQuantity(2, "PROPORTIONAL_EQUITY", 1, 10000, 2500), 0.5);
  assert.equal(allocateQuantity(0.01, "MULTIPLIER", 0.25), 0.0025);
});
test("MAM rejects invalid sizing and unavailable equity", () => {
  assert.throws(() => allocateQuantity(1, "PROPORTIONAL_EQUITY", 1, 0, 100));
  assert.throws(() => allocateQuantity(1, "MULTIPLIER", -1));
});
