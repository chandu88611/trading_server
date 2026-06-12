import test from "node:test";
import assert from "node:assert/strict";

const AppDataSource = require("../../db/data-source").default;
const { SubscriberTradeAlert } = require("../../entity");
const { TradeAlertDBService } = require("../../app/trade/services/tradeAlert.db");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

test("TradeAlertDBService: ensureSchema creates subscriber trade alert storage", async () => {
  const queries: string[] = [];
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreQuery = patch(AppDataSource, "query", async (sql: string) => {
    queries.push(sql);
    return [];
  });

  try {
    const db = new TradeAlertDBService();
    await db.ensureSchema();

    assert.ok(
      queries.some((sql) =>
        sql.includes("CREATE TABLE IF NOT EXISTS subscriber_trade_alerts")
      )
    );
    assert.ok(
      queries.some((sql) =>
        sql.includes("idx_subscriber_trade_alerts_user_is_read_created_at")
      )
    );
  } finally {
    restoreQuery();
    restoreGetRepository();
  }
});

test("TradeAlertDBService: creates alerts only for new BUY or SELL trade signals", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let createdRows: any[] = [];
  let savedRows: any[] = [];
  const queryRunner = {
    manager: {
      getRepository(entity: any) {
        if (entity !== SubscriberTradeAlert) {
          throw new Error("unexpected_repository");
        }
        return {
          create(rows: any[]) {
            createdRows = rows;
            return rows;
          },
          async save(rows: any[]) {
            savedRows = rows;
            return rows;
          },
        };
      },
    },
  };

  try {
    const db = new TradeAlertDBService();
    await db.createForTradeSignals(
      [
        {
          id: 10,
          userId: 7,
          subscriptionId: 3,
          tradingAccountId: 8,
          adminStrategyTradeId: 99,
          action: "BUY",
          symbol: "EURUSD",
          exchange: "FX",
          price: 1.081,
          volume: 0.01,
          signalTime: new Date("2026-05-17T10:00:05.000Z"),
          executionMode: "OPEN",
        },
        {
          id: 11,
          userId: 7,
          subscriptionId: 3,
          tradingAccountId: 8,
          adminStrategyTradeId: 99,
          action: "SELL",
          symbol: "EURUSD",
          exchange: "FX",
          price: 1.082,
          volume: 0.01,
          signalTime: new Date("2026-05-17T10:01:05.000Z"),
          executionMode: null,
        },
        {
          id: 12,
          userId: 7,
          subscriptionId: 3,
          tradingAccountId: 8,
          adminStrategyTradeId: 99,
          action: "HOLD",
          symbol: "EURUSD",
          exchange: "FX",
          price: 1.083,
          volume: 0.01,
          signalTime: new Date("2026-05-17T10:02:05.000Z"),
          executionMode: "AMEND_SLTP",
        },
      ] as any,
      queryRunner as any
    );

    assert.equal(createdRows.length, 2);
    assert.deepEqual(
      createdRows.map((row) => row.tradeSignalId),
      [10, 11]
    );
    assert.equal(createdRows[0].eventType, "trade_placed");
    assert.deepEqual(savedRows, createdRows);
  } finally {
    restoreGetRepository();
  }
});
