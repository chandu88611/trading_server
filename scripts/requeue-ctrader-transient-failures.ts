import "reflect-metadata";
import AppDataSource from "../src/db/data-source";
import { CTradeSignalDB } from "../src/app/cTraderListener/services/cTrader.db";

type Candidate = {
  id: number;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: Date;
  order_id: string | number | null;
  broker_order_id: string | number | null;
  broker_position_id: string | number | null;
};

function parseArgs(argv: string[]) {
  const out: {
    apply: boolean;
    sinceHours: number;
    signalIds: number[];
  } = {
    apply: false,
    sinceHours: 72,
    signalIds: [],
  };

  for (const arg of argv) {
    if (arg === "--apply") {
      out.apply = true;
      continue;
    }

    if (arg.startsWith("--since-hours=")) {
      const parsed = Number(arg.split("=")[1]);
      if (Number.isFinite(parsed) && parsed > 0) out.sinceHours = parsed;
      continue;
    }

    if (arg.startsWith("--signal-ids=")) {
      out.signalIds = arg
        .split("=")[1]
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value) && value > 0);
    }
  }

  return out;
}

function looksTransient(lastError: string | null): boolean {
  const text = String(lastError ?? "").trim().toLowerCase();
  if (!text) return true;

  return [
    "timeout_after_",
    "accounts_timeout_after_",
    "accounts_fetch_failed status=500",
    "accounts_fetch_failed status=502",
    "accounts_fetch_failed status=503",
    "exec_failed status=500",
    "exec_failed status=502",
    "exec_failed status=503",
    "close_exec_failed status=500",
    "close_exec_failed status=502",
    "close_exec_failed status=503",
    "disconnected",
    "not connected",
    "fetch failed",
    "appauth",
  ].some((needle) => text.includes(needle));
}

function targetStatus(candidate: Candidate): "pending" | "pending_close" {
  return candidate.order_id || candidate.broker_order_id || candidate.broker_position_id
    ? "pending_close"
    : "pending";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await AppDataSource.initialize();
  await new CTradeSignalDB().ensureSchema();

  const rows: Candidate[] = args.signalIds.length > 0
    ? await AppDataSource.query(
        `
        SELECT
          ts.id,
          tss.status,
          tss.attempts,
          tss.last_error,
          ts.created_at,
          ts.order_id,
          ts.broker_order_id,
          ts.broker_position_id
        FROM trade_signals ts
        INNER JOIN trade_signals_status tss ON tss.signal_id = ts.id
        INNER JOIN user_trading_accounts ta ON ta.id = ts.trading_account_id
        INNER JOIN brokers b ON b.id = ta.broker_id
        WHERE b.code = 'CT'
          AND tss.status = 'failed'
          AND ts.id = ANY($1::int[])
        ORDER BY ts.id ASC
        `,
        [args.signalIds],
      )
    : await AppDataSource.query(
        `
        SELECT
          ts.id,
          tss.status,
          tss.attempts,
          tss.last_error,
          ts.created_at,
          ts.order_id,
          ts.broker_order_id,
          ts.broker_position_id
        FROM trade_signals ts
        INNER JOIN trade_signals_status tss ON tss.signal_id = ts.id
        INNER JOIN user_trading_accounts ta ON ta.id = ts.trading_account_id
        INNER JOIN brokers b ON b.id = ta.broker_id
        WHERE b.code = 'CT'
          AND tss.status = 'failed'
          AND ts.created_at >= NOW() - ($1 * INTERVAL '1 hour')
        ORDER BY ts.id ASC
        `,
        [args.sinceHours],
      );

  const candidates = rows.filter((row) => looksTransient(row.last_error));

  console.log("[CTRADER_REQUEUE] candidates", candidates.map((row) => ({
    id: Number(row.id),
    attempts: Number(row.attempts ?? 0),
    lastError: row.last_error ?? null,
    targetStatus: targetStatus(row),
  })));

  if (!args.apply) {
    console.log("[CTRADER_REQUEUE] dry run only. Re-run with --apply to persist changes.");
    await AppDataSource.destroy();
    return;
  }

  for (const row of candidates) {
    await AppDataSource.query(
      `
      UPDATE trade_signals_status
      SET status = $2,
          attempts = 0,
          last_error = $3,
          next_retry_at = NOW(),
          updated_at = NOW()
      WHERE signal_id = $1
      `,
      [
        Number(row.id),
        targetStatus(row),
        `manual_requeue_after_transient_failure:${String(row.last_error ?? "historical_failed_signal").slice(0, 180)}`,
      ],
    );
  }

  console.log(`[CTRADER_REQUEUE] requeued=${candidates.length}`);
  await AppDataSource.destroy();
}

void main().catch(async (error) => {
  console.error("[CTRADER_REQUEUE] failed", error);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
