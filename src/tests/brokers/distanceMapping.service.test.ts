import test from "node:test";
import assert from "node:assert/strict";

import { DistanceMappingService } from "../../app/trade/services/distanceMapping.service";

test("DistanceMappingService: maps standard forex pairs using family rules", () => {
  const service = new DistanceMappingService();

  const eurusd = service.resolve({
    broker: "CTRADER",
    symbol: "EURUSD",
    requestedDistance: 10,
  });
  const usdjpy = service.resolve({
    broker: "CTRADER",
    symbol: "USDJPY",
    requestedDistance: 10,
  });

  assert.equal(eurusd.priceDistance, 0.001);
  assert.equal(eurusd.source, "family_rule");
  assert.equal(usdjpy.priceDistance, 0.1);
  assert.equal(usdjpy.source, "family_rule");
});

test("DistanceMappingService: maps XAUUSD and index overrides without broker metadata", () => {
  const service = new DistanceMappingService();

  const xauusd = service.resolve({
    broker: "MT5",
    symbol: "XAUUSD",
    requestedDistance: 10,
  });
  const us30 = service.resolve({
    broker: "MT5",
    symbol: "US30",
    requestedDistance: 10,
  });

  assert.equal(xauusd.priceDistance, 1);
  assert.equal(xauusd.source, "symbol_override");
  assert.equal(us30.priceDistance, 10);
  assert.equal(us30.source, "symbol_override");
});

test("DistanceMappingService: prefers broker metadata when available", () => {
  const service = new DistanceMappingService();

  const ctrader = service.resolve({
    broker: "CTRADER",
    symbol: "EURUSD",
    requestedDistance: 10,
    cTraderMeta: { pipPosition: 5 },
  });
  const mt5 = service.resolve({
    broker: "MT5",
    symbol: "EURUSD",
    requestedDistance: 10,
    mt5Meta: { digits: 5, point: 0.00001 },
  });

  assert.equal(ctrader.priceDistance, 0.0001);
  assert.equal(ctrader.source, "ctrader_pip_position");
  assert.equal(mt5.priceDistance, 0.001);
  assert.equal(mt5.source, "mt5_point_digits");
});

test("DistanceMappingService: rejects invalid inputs and unmapped symbols", () => {
  const service = new DistanceMappingService();

  assert.throws(() =>
    service.resolve({
      broker: "CTRADER",
      symbol: "EURUSD",
      requestedDistance: 0.5,
    }),
  /invalid_distance_value/);

  assert.throws(() =>
    service.resolve({
      broker: "MT5",
      symbol: "FOOBAR",
      requestedDistance: 10,
    }),
  /distance_mapping_unavailable/);
});
