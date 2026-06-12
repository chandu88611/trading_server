import test from "node:test";
import assert from "node:assert/strict";

const AppDataSource = require("../../db/data-source").default;
const { AlertSnapshotDB } = require("../../app/broker/brokerAlerts/services/alertSnapshot.db");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

test("AlertSnapshotDB: ensureSchema creates admin strategy trade parent links", async () => {
  const queries: string[] = [];
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreQuery = patch(AppDataSource, "query", async (sql: string) => {
    queries.push(sql);
    return [];
  });

  try {
    const db = new AlertSnapshotDB();
    await db.ensureSchema();

    assert.ok(
      queries.some((sql) => sql.includes("CREATE TABLE IF NOT EXISTS admin_strategy_trades"))
    );
    assert.ok(
      queries.some((sql) =>
        sql.includes("ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS admin_strategy_trade_id")
      )
    );
    assert.ok(
      queries.some((sql) =>
        sql.includes("ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS admin_strategy_trade_id")
      )
    );
    assert.ok(
      queries.some((sql) =>
        sql.includes("ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS strategy_id")
      )
    );
  } finally {
    restoreQuery();
    restoreGetRepository();
  }
});
