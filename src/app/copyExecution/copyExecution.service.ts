import crypto from "crypto";
import { QueryRunner } from "typeorm";
import AppDataSource from "../../db/data-source";
import { AssetClassifier, AssetType, MarketType } from "../../types/trade-identify";
import { HttpStatusCode } from "../../types/constants";

type MarketCategory = "INDIA" | "FOREX";
type JsonRecord = Record<string, any>;

function badRequest(message: string) {
  return { statusCode: HttpStatusCode._BAD_REQUEST, message };
}

function normalizeMode(value: unknown): MarketCategory {
  const mode = String(value ?? "").trim().toUpperCase();
  if (mode === "INDIA" || mode === "INDIAN") return "INDIA";
  if (mode === "FOREX") return "FOREX";
  throw badRequest("invalid_mode");
}

function normalizeSide(value: unknown) {
  const side = String(value ?? "").trim().toUpperCase();
  if (side === "BUY" || side === "SELL") return side;
  throw badRequest("invalid_side");
}

function normalizeString(value: unknown, name: string, required = true) {
  const text = String(value ?? "").trim();
  if (required && !text) throw badRequest(`${name}_required`);
  return text;
}

function parseTargets(value: unknown) {
  if (!Array.isArray(value)) throw badRequest("targets_required");
  const ids = value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
  if (!ids.length) throw badRequest("targets_required");
  return Array.from(new Set(ids));
}

function marketCodeForMode(mode: MarketCategory) {
  return mode === "INDIA" ? "INDIAN" : "FOREX";
}

function sqlArray(ids: number[]) {
  return `{${ids.join(",")}}`;
}

export class CopyExecutionService {
  async ensureSchema() {
    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS user_copy_links (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        mode TEXT NOT NULL,
        strategy_id TEXT NOT NULL,
        target_account_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        settings JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(user_id, mode, strategy_id)
      );
    `);

    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_user_copy_links_user_mode
      ON user_copy_links(user_id, mode);
    `);
  }

  async listStrategies(userId: number, mode: MarketCategory) {
    return AppDataSource.query(
      `
      SELECT DISTINCT s.id, s.name, s.strategy_code AS "strategyCode",
             s.category, m.code AS market, s.risk_profile AS "riskProfile",
             s.is_active AS "isActive"
      FROM user_subscriptions us
      INNER JOIN subscription_plans p ON p.id = us.plan_id
      LEFT JOIN markets m ON m.id = p.market_id
      INNER JOIN plan_strategies ps ON ps.plan_id = p.id
      INNER JOIN strategies s ON s.id = ps.strategy_id
      WHERE us.user_id = $1
        AND us.status_v2 = 'active'
        AND p.is_active = true
        AND s.is_active = true
        AND COALESCE(s.is_deprecated, false) = false
        AND (m.code = $2 OR ($2 = 'FOREX' AND s.category = 'FOREX'))
      ORDER BY s.name ASC
      `,
      [userId, marketCodeForMode(mode)]
    );
  }

  async listLinks(userId: number, mode: MarketCategory) {
    return AppDataSource.query(
      `
      SELECT id, mode, strategy_id AS "strategyId",
             target_account_ids AS "targetAccountIds", settings,
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM user_copy_links
      WHERE user_id = $1 AND mode = $2
      ORDER BY updated_at DESC
      `,
      [userId, mode]
    );
  }

  async searchSymbols(userId: number, mode: MarketCategory, query: unknown) {
    const q = String(query ?? "").trim().toUpperCase();
    if (q.length < 1) return [];

    return AppDataSource.query(
      `
      SELECT DISTINCT ts.symbol, ts.exchange,
             ts.symbol AS name,
             ts.asset_type AS segment
      FROM trade_signals ts
      WHERE ts.user_id = $1
        AND ($2 = 'FOREX' OR ts.exchange IN ('NSE', 'BSE', 'NFO', 'MCX'))
        AND (UPPER(ts.symbol) LIKE $3 OR UPPER(ts.exchange) LIKE $3)
      ORDER BY ts.symbol ASC
      LIMIT 25
      `,
      [userId, mode, `%${q}%`]
    );
  }

  async upsertLink(userId: number, body: JsonRecord) {
    const mode = normalizeMode(body.mode);
    const strategyId = normalizeString(body.strategyId ?? body.strategy_id, "strategyId");
    const targetIds = parseTargets(body.targetAccountIds ?? body.target_account_ids);
    const settings = body.settings && typeof body.settings === "object" && !Array.isArray(body.settings)
      ? body.settings
      : {};

    await this.ensureAccountsBelongToUser(userId, targetIds);

    const rows = await AppDataSource.query(
      `
      INSERT INTO user_copy_links(user_id, mode, strategy_id, target_account_ids, settings, updated_at)
      VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, now())
      ON CONFLICT (user_id, mode, strategy_id) DO UPDATE
      SET target_account_ids = EXCLUDED.target_account_ids,
          settings = EXCLUDED.settings,
          updated_at = now()
      RETURNING id, mode, strategy_id AS "strategyId",
                target_account_ids AS "targetAccountIds", settings,
                created_at AS "createdAt", updated_at AS "updatedAt"
      `,
      [userId, mode, strategyId, JSON.stringify(targetIds.map(String)), JSON.stringify(settings)]
    );

    return rows[0];
  }

  async deleteLink(userId: number, mode: MarketCategory, strategyId: string) {
    const rows = await AppDataSource.query(
      `
      DELETE FROM user_copy_links
      WHERE user_id = $1 AND mode = $2 AND strategy_id = $3
      RETURNING id, mode, strategy_id AS "strategyId"
      `,
      [userId, mode, strategyId]
    );
    return rows[0] ?? null;
  }

  private async ensureAccountsBelongToUser(userId: number, targetIds: number[]) {
    const rows = await AppDataSource.query(
      `
      SELECT id
      FROM user_trading_accounts
      WHERE user_id = $1
        AND id = ANY($2::bigint[])
        AND is_enabled = true
      `,
      [userId, sqlArray(targetIds)]
    );
    if (rows.length !== targetIds.length) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "invalid_target_accounts" };
    }
    return rows;
  }

  async placeManualTrade(userId: number, body: JsonRecord) {
    const mode = normalizeMode(body.mode);
    const side = normalizeSide(body.side);
    const targets = parseTargets(body.targets);
    const symbol = normalizeString(body.symbol, "symbol").toUpperCase();
    const exchange = normalizeString(body.exchange, "exchange", mode === "INDIA") || (mode === "FOREX" ? "FOREX" : "NSE");
    const quantity = mode === "FOREX" ? Number(body.lots) : Number(body.qty);
    if (!Number.isFinite(quantity) || quantity <= 0) throw badRequest(mode === "FOREX" ? "lots_required" : "qty_required");

    const accounts = await this.ensureAccountsBelongToUser(userId, targets);
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const snapshotId = await this.createManualSnapshot(queryRunner, {
        userId,
        mode,
        symbol,
        exchange,
        body,
      });
      const inserted = [];
      for (const account of accounts) {
        const signalId = await this.createManualSignal(queryRunner, {
          userId,
          tradingAccountId: Number(account.id),
          snapshotId,
          mode,
          side,
          symbol,
          exchange,
          quantity,
          body,
        });
        inserted.push({
          targetId: String(account.id),
          status: "accepted",
          signalId,
        });
      }

      await queryRunner.commitTransaction();
      return {
        requestId: crypto.randomUUID(),
        requested: targets.length,
        accepted: inserted.length,
        failed: 0,
        snapshotId,
        items: inserted,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async createManualSnapshot(
    queryRunner: QueryRunner,
    args: {
      userId: number;
      mode: MarketCategory;
      symbol: string;
      exchange: string;
      body: JsonRecord;
    }
  ) {
    const now = new Date();
    const price = Number(args.body.price ?? args.body.close ?? 0);
    const rows = await queryRunner.manager.query(
      `
      INSERT INTO alert_snapshots(
        ticker, exchange, interval, bar_time, alert_time, open, close, high, low,
        volume, execution_mode, entry_ref, order_type, limit_price, stop_price,
        stop_loss, take_profit, user_id
      )
      VALUES ($1, $2, $3, $4, $4, $5, $5, $5, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id
      `,
      [
        args.symbol,
        args.exchange,
        "manual",
        now,
        Number.isFinite(price) ? price : 0,
        Number(args.body.qty ?? args.body.lots ?? 0),
        String(args.body.executionMode ?? "OPEN"),
        String(args.body.clientOrderId ?? `manual-${crypto.randomUUID()}`),
        String(args.body.orderType ?? "MARKET"),
        args.body.price ?? null,
        args.body.triggerPrice ?? null,
        args.body.slPrice ?? null,
        args.body.tpPrice ?? null,
        args.userId,
      ]
    );
    return Number(rows[0].id);
  }

  private async createManualSignal(
    queryRunner: QueryRunner,
    args: {
      userId: number;
      tradingAccountId: number;
      snapshotId: number;
      mode: MarketCategory;
      side: "BUY" | "SELL";
      symbol: string;
      exchange: string;
      quantity: number;
      body: JsonRecord;
    }
  ) {
    const detected = AssetClassifier.detect({
      symbol: args.symbol,
      exchange: args.exchange,
      market: args.mode === "INDIA" ? MarketType.INDIAN : MarketType.FOREX,
    });
    const assetType = detected === AssetType.UNKNOWN && args.mode === "FOREX" ? AssetType.FOREX : detected;
    const price = Number(args.body.price ?? args.body.close ?? 0);
    const rows = await queryRunner.manager.query(
      `
      INSERT INTO trade_signals(
        action, symbol, price, exchange, asset_type, signal_time, volume,
        execution_mode, entry_ref, order_type, limit_price, stop_price,
        stop_loss, take_profit, user_id, trading_account_id, alert_snapshots_id
      )
      VALUES ($1, $2, $3, $4, $5, now(), $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id
      `,
      [
        args.side,
        args.symbol,
        Number.isFinite(price) ? price : 0,
        args.exchange,
        assetType,
        args.quantity,
        String(args.body.executionMode ?? "OPEN"),
        String(args.body.clientOrderId ?? `manual-${args.snapshotId}`),
        String(args.body.orderType ?? "MARKET"),
        args.body.price ?? null,
        args.body.triggerPrice ?? null,
        args.body.slPrice ?? null,
        args.body.tpPrice ?? null,
        args.userId,
        args.tradingAccountId,
        args.snapshotId,
      ]
    );
    const signalId = Number(rows[0].id);
    await queryRunner.manager.query(
      `
      INSERT INTO trade_signals_status(signal_id, status, created_at, updated_at)
      VALUES ($1, 'pending', now(), now())
      `,
      [signalId]
    );
    return signalId;
  }
}
