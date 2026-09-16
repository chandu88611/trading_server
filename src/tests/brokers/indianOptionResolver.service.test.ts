import test from "node:test";
import assert from "node:assert/strict";
import AppDataSource from "../../db/data-source";
import { BrokerInstrument } from "../../entity/BrokerInstrument";
import {
  BrokerInstrumentService,
  parseInstrumentMasterCsv,
} from "../../app/india/options/brokerInstrument.service";
import {
  IndianOptionResolverService,
  OptionResolverConfig,
} from "../../app/india/options/indianOptionResolver.service";
import { ZebuService } from "../../app/zebu/services/zebu.service";
import { AlertSnapshotService } from "../../app/broker/brokerAlerts/services/alertSnapshot.service";
import { AssetType } from "../../types/trade-identify";
import { UserStrategyStatus } from "../../app/subscriptionPlan/enums/subscriberPlan.enum";

const config: OptionResolverConfig = {
  enabled: true,
  instrumentType: "OPTIONS",
  expiryMode: "NEAREST",
  strikeMode: "ATM",
  strikeOffsetSteps: 0,
  defaultLots: 1,
  candidateStrikesEachSide: 2,
  minDaysToExpiry: 1,
  minVolumeLots: 5,
  minTopDepthLots: 1,
  maxSpreadPercent: 3,
};

function contract(
  id: number,
  strike: number,
  optionType: "CE" | "PE",
  expiry = "2027-06-24",
): BrokerInstrument {
  return {
    id,
    brokerCode: "ZEBU",
    exchange: "NFO",
    brokerToken: `token-${id}`,
    underlying: "RELIANCE",
    tradingSymbol: `RELIANCE${expiry.replace(/-/g, "")}${optionType}${strike}`,
    instrumentType: "OPTIONS",
    optionType,
    strike,
    expiry,
    lotSize: 500,
    tickSize: 0.05,
    raw: {},
    isActive: true,
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function payload(action: "BUY" | "SELL", close = 102): any {
  return {
    userId: 10,
    market: "INDIAN",
    ticker: "RELIANCE",
    exchange: "NSE",
    interval: "signal",
    barTime: new Date(),
    alertTime: new Date(),
    open: close,
    close,
    high: close,
    low: close,
    volume: 2,
    lots: 2,
    action,
    executionMode: "OPEN",
    entryRef: "lux-test",
  };
}

function quote(token: string, overrides: Record<string, number> = {}) {
  return {
    token,
    exchange: "NFO",
    tradingSymbol: token,
    ltp: overrides.ltp ?? 10,
    volume: overrides.volume ?? 10000,
    bid: overrides.bid ?? 9.95,
    ask: overrides.ask ?? 10.05,
    bidQty: overrides.bidQty ?? 5000,
    askQty: overrides.askQty ?? 5000,
    raw: {},
  };
}

test("Broker instrument parser normalizes Zebu option rows and BFO underlying aliases", () => {
  const rows = parseInstrumentMasterCsv(
    [
      "Exchange,Token,LotSize,Symbol,TradingSymbol,Expiry,Instrument,OptionType,StrikePrice,TickSize,",
      "BFO,837931,20,BSXOPT,SENSEX26SEP91000PE,24-SEP-2026,OPTIDX,PE,91000,0.05,",
      "NFO,165423,500,RELIANCE,RELIANCE30JUN26C1960,30-JUN-2026,OPTSTK,CE,1960,0.05,",
    ].join("\n"),
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0].underlying, "SENSEX");
  assert.equal(rows[0].instrumentType, "OPTIONS");
  assert.equal(rows[0].expiry, "2026-09-24");
  assert.equal(rows[1].underlying, "RELIANCE");
  assert.equal(rows[1].lotSize, 500);
});

test("Broker instrument sync rejects unsupported segments before downloading", async () => {
  const service = new BrokerInstrumentService();
  await assert.rejects(
    () => service.sync(["../NSE"]),
    (error: any) => error?.statusCode === 400 && error?.message === "invalid_instrument_segment",
  );
});

test("Broker instrument sync upserts then deactivates stale rows in one transaction", async () => {
  const service = new BrokerInstrumentService();
  const queries: string[] = [];
  let committed = false;
  const original = AppDataSource.createQueryRunner;
  (service as any).downloadSegment = async () => [contract(1, 100, "CE")];
  (AppDataSource as any).createQueryRunner = () => ({
    connect: async () => undefined,
    startTransaction: async () => undefined,
    query: async (sql: string) => queries.push(sql),
    commitTransaction: async () => {
      committed = true;
    },
    rollbackTransaction: async () => undefined,
    release: async () => undefined,
  });

  try {
    const result = await (service as any).performSync(["NFO"]);
    assert.equal(result.segments[0].count, 1);
    assert.equal(committed, true);
    assert.ok(queries.some((sql) => sql.includes("ON CONFLICT")));
    assert.ok(queries.some((sql) => sql.includes("SET is_active = false")));
  } finally {
    (AppDataSource as any).createQueryRunner = original;
  }
});

test("Broker instrument sync rolls back when an upsert fails", async () => {
  const service = new BrokerInstrumentService();
  let rolledBack = false;
  const original = AppDataSource.createQueryRunner;
  (service as any).downloadSegment = async () => [contract(1, 100, "CE")];
  (AppDataSource as any).createQueryRunner = () => ({
    connect: async () => undefined,
    startTransaction: async () => undefined,
    query: async () => {
      throw new Error("write_failed");
    },
    commitTransaction: async () => undefined,
    rollbackTransaction: async () => {
      rolledBack = true;
    },
    release: async () => undefined,
  });

  try {
    await assert.rejects(() => (service as any).performSync(["NFO"]), /write_failed/);
    assert.equal(rolledBack, true);
  } finally {
    (AppDataSource as any).createQueryRunner = original;
  }
});

test("Indian option resolver maps BUY to bought CE and converts lots to quantity", async () => {
  const contracts = [contract(1, 90, "CE"), contract(2, 100, "CE"), contract(3, 110, "CE")];
  const resolver = new IndianOptionResolverService(
    { findOptionContracts: async () => contracts } as any,
    {
      getUnderlyingLtp: async () => 102,
      getQuote: async (_exchange: string, token: string) =>
        quote(token, token === "token-2" ? { bid: 9.99, ask: 10.01 } : { bid: 9.8, ask: 10.2 }),
    } as any,
  );

  const resolved = await resolver.resolve(payload("BUY"), config);
  assert.equal(resolved.action, "BUY");
  assert.equal(resolved.sourceAction, "BUY");
  assert.equal(resolved.optionType, "CE");
  assert.equal(resolved.strike, 100);
  assert.equal(resolved.exchange, "NFO");
  assert.equal(resolved.product, "INTRADAY");
  assert.equal(resolved.volume, 1000);
  assert.equal(resolved.instrumentToken, "token-2");
});

test("Indian option resolver maps SELL direction to a bought PE", async () => {
  const contracts = [contract(10, 90, "PE"), contract(11, 100, "PE"), contract(12, 110, "PE")];
  const resolver = new IndianOptionResolverService(
    { findOptionContracts: async () => contracts } as any,
    {
      getUnderlyingLtp: async () => 102,
      getQuote: async (_exchange: string, token: string) => quote(token),
    } as any,
  );

  const resolved = await resolver.resolve(payload("SELL"), config);
  assert.equal(resolved.action, "BUY");
  assert.equal(resolved.sourceAction, "SELL");
  assert.equal(resolved.optionType, "PE");
});

test("Indian option resolver uses TradingView close when underlying quote is unavailable", async () => {
  const resolver = new IndianOptionResolverService(
    { findOptionContracts: async () => [contract(20, 100, "CE")] } as any,
    {
      getUnderlyingLtp: async () => null,
      getQuote: async (_exchange: string, token: string) => quote(token),
    } as any,
  );
  const resolved = await resolver.resolve(payload("BUY", 101), config);
  assert.equal(resolved.strike, 100);
});

test("Indian option resolver chooses the final expiry of the nearest month in MONTHLY mode", async () => {
  const contracts = [
    contract(30, 100, "CE", "2027-06-03"),
    contract(31, 100, "CE", "2027-06-24"),
    contract(32, 100, "CE", "2027-07-29"),
  ];
  const resolver = new IndianOptionResolverService(
    { findOptionContracts: async () => contracts } as any,
    {
      getUnderlyingLtp: async () => 100,
      getQuote: async (_exchange: string, token: string) => quote(token),
    } as any,
  );
  const resolved = await resolver.resolve(payload("BUY", 100), { ...config, expiryMode: "MONTHLY" });
  assert.equal(resolved.expiry, "2027-06-24");
});

test("Indian option resolver rejects same-day or expired contracts even if returned by storage", async () => {
  let quoted = false;
  const resolver = new IndianOptionResolverService(
    { findOptionContracts: async () => [contract(35, 100, "CE", "2000-01-01")] } as any,
    {
      getUnderlyingLtp: async () => 100,
      getQuote: async () => {
        quoted = true;
        return quote("token-35");
      },
    } as any,
  );

  await assert.rejects(
    () => resolver.resolve(payload("BUY", 100), config),
    (error: any) => error?.statusCode === 422 && error?.message === "option_contracts_not_found",
  );
  assert.equal(quoted, false);
});

test("Indian option resolver rejects contracts with excessive spread", async () => {
  const resolver = new IndianOptionResolverService(
    { findOptionContracts: async () => [contract(40, 100, "CE")] } as any,
    {
      getUnderlyingLtp: async () => 100,
      getQuote: async (_exchange: string, token: string) => quote(token, { bid: 8, ask: 12 }),
    } as any,
  );
  await assert.rejects(
    () => resolver.resolve(payload("BUY", 100), config),
    (error: any) => error?.statusCode === 422 && error?.message === "option_spread_too_wide",
  );
});

test("Indian option resolver bypasses complete broker-ready option payloads", async () => {
  let called = false;
  const resolver = new IndianOptionResolverService(
    { findOptionContracts: async () => { called = true; return []; } } as any,
    {} as any,
  );
  const complete = {
    ...payload("BUY"),
    instrumentType: "OPTIONS",
    underlying: "RELIANCE",
    expiry: "2027-06-24",
    optionType: "CE",
    strike: 100,
    tradingSymbol: "EXACT-OPTION",
  };
  const resolved = await resolver.resolve(complete, config);
  assert.equal(resolved.tradingSymbol, "EXACT-OPTION");
  assert.equal(called, false);
});

test("Zebu execution builds an enriched option order from the exact saved contract", () => {
  const service = new ZebuService();
  const order = (service as any).buildOrderFromSignal({
    id: 99,
    action: "BUY",
    symbol: "RELIANCE",
    exchange: "NFO",
    volume: 1000,
    instrumentType: "OPTIONS",
    optionType: "CE",
    expiry: "2027-06-24",
    strike: 100,
    tradingSymbol: "RELIANCE-EXACT-OPTION",
    brokerInstrumentId: 7,
    instrumentToken: "token-7",
    product: "I",
    orderType: "MARKET",
  });
  assert.equal(order.symbol, "RELIANCE-EXACT-OPTION");
  assert.equal(order.exchange, "NFO");
  assert.equal(order.side, "BUY");
  assert.equal(order.quantity, 1000);
  assert.equal(order.product, "I");
});

test("Strategy TradingView ingestion resolves one Lux option before creating trade signals", async () => {
  const original = AppDataSource.createQueryRunner;
  let rollbacks = 0;
  (AppDataSource as any).createQueryRunner = () => ({
    connect: async () => undefined,
    startTransaction: async () => undefined,
    commitTransaction: async () => undefined,
    rollbackTransaction: async () => {
      rollbacks += 1;
    },
    release: async () => undefined,
    manager: {},
  });
  const createdSignals: any[] = [];

  try {
    const service = new AlertSnapshotService();
    (service as any).optionResolver = {
      resolveConfig: () => config,
      resolve: async (incoming: any) => ({
        ...incoming,
        action: "BUY",
        sourceAction: "SELL",
        ticker: "RELIANCE",
        underlying: "RELIANCE",
        exchange: "NFO",
        instrumentType: "OPTIONS",
        optionType: "PE",
        strike: 100,
        expiry: "2027-06-24",
        tradingSymbol: "RELIANCE-EXACT-PE",
        brokerInstrumentId: 77,
        instrumentToken: "token-77",
        tickSize: 0.05,
        product: "INTRADAY",
        close: 10,
        volume: 1000,
      }),
    };
    (service as any).isValidAssetType = async () => AssetType.FUTURES;
    (service as any).subscriptionPlanService = {
      getPlan: async () => ({
        id: 200,
        isActive: true,
        market: { code: "INDIAN" },
        planStrategies: [{
          strategyId: 300,
          strategy: { id: 300, defaultParams: { optionResolver: { enabled: true } } },
        }],
      }),
    };
    (service as any).userSubscriptionDbService = {
      getActiveStrategySubscriptionsForPlan: async () => [
        { id: 1, userId: 10, planId: 200, user: { isAdmin: false } },
      ],
      getStrategyInstancesBySubscriptionIds: async () => [{
        id: 500,
        subscriptionId: 1,
        strategyId: 300,
        planId: 200,
        status: UserStrategyStatus.ACTIVE,
        volume: "0.01",
      }],
    };
    (service as any).alertSnapshotDB = {
      createAdminStrategyTrade: async () => ({ id: 700 }),
      updateAdminStrategyTradeFanout: async () => undefined,
      create: async () => ({ id: 800 }),
      getBrokerIdByCodes: async () => [9],
      closeOppositeCompletedTrades: async () => 0,
    };
    (service as any).tradingAccountService = {
      resolveStrategyExecutionTargets: async () => ({
        accounts: [{ userId: 10, id: 900 }],
        eligibleOwnedAccountIds: [900],
        masterAccountIds: [],
        followerAccountIds: [],
      }),
    };
    (service as any).tradeSignalService = {
      createTradeSignal: async (signals: any[]) => createdSignals.push(...signals),
    };
    (service as any).userDBService = {
      getEdgingStatus: async () => ({ userId: 10, isEnabled: false }),
    };

    const result = await service.createForPlan(200, {
      ticker: "RELIANCE",
      action: "SELL",
      exchange: "NSE",
      product: "INTRADAY",
      lots: 2,
      strategy: "LUX_ALGO",
      close: 102,
    } as any);

    assert.equal(result.signalCount, 1);
    assert.equal(createdSignals[0].action, "BUY");
    assert.equal(createdSignals[0].sourceAction, "SELL");
    assert.equal(createdSignals[0].tradingSymbol, "RELIANCE-EXACT-PE");
    assert.equal(createdSignals[0].product, "I");
    assert.equal(createdSignals[0].volume, 1000);

    (service as any).optionResolver.resolve = async () => {
      throw { statusCode: 422, message: "option_no_liquid_contract" };
    };
    await assert.rejects(
      () => service.createForPlan(200, {
        ticker: "RELIANCE",
        action: "SELL",
        exchange: "NSE",
        lots: 2,
        strategy: "LUX_ALGO",
        close: 102,
      } as any),
      (error: any) => error?.statusCode === 422 && error?.message === "option_no_liquid_contract",
    );
    assert.equal(createdSignals.length, 1);
    assert.equal(rollbacks, 1);
  } finally {
    (AppDataSource as any).createQueryRunner = original;
  }
});
