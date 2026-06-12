import AppDataSource, { ensureAppDataSourceInitialized } from "../db/data-source";
import { ZebuService } from "../app/zebu/services/zebu.service";

const zebu = new ZebuService();

const intervalMs = Number(process.env.ZEBU_EXEC_INTERVAL_MS ?? 500);
const batchSize  = Number(process.env.ZEBU_EXEC_BATCH_SIZE ?? 25);

let inFlight = false;
let lastDbInitErrorAt = 0;
let schemaReady = false;
let intradayAutoCloseFired = false;

function istNow() {
  return new Date(Date.now() + 330 * 60_000);
}

function isWeekday(ist: Date) {
  const day = ist.getUTCDay(); // 0=Sun, 6=Sat
  return day !== 0 && day !== 6;
}

/** NSE/BSE equities and F&O: 09:15 – 15:30 IST */
function isNseMarketOpen(): boolean {
  const ist = istNow();
  if (!isWeekday(ist)) return false;
  const min = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return min >= 9 * 60 + 15 && min < 15 * 60 + 30;
}

/** MCX commodity: 09:00 – 23:30 IST */
function isMcxMarketOpen(): boolean {
  const ist = istNow();
  if (!isWeekday(ist)) return false;
  const min = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return min >= 9 * 60 && min < 23 * 60 + 30;
}

function isAnyMarketOpen(): boolean {
  return isNseMarketOpen() || isMcxMarketOpen();
}

// ── Main execution loop (500 ms) ─────────────────────────────────────────────
setInterval(async () => {
	if (inFlight) return;
	inFlight = true;

	try {
			if (!AppDataSource.isInitialized) {
				await ensureAppDataSourceInitialized();
			}
			if (!schemaReady) {
				await zebu.ensureSchema();
				schemaReady = true;
			}

			if (!isAnyMarketOpen()) {
				return; // Hold jobs; don't mark failed
			}

			// Only place NEW orders during NSE window (or MCX window)
			// Protection monitors (SL/TP) run as long as any market is open
			if (isNseMarketOpen() || isMcxMarketOpen()) {
				await zebu.executePendingBatch({ batchSize });
			}

			await zebu.executeProtectionBatch({ batchSize });
			await zebu.executeClosePendingBatch({ batchSize });
	} catch (e) {
			const isDriverNotConnected =
				e instanceof Error && String(e.message || "").includes("Driver not Connected");
			if (isDriverNotConnected) {
				const now = Date.now();
				if (now - lastDbInitErrorAt >= 10000) {
					lastDbInitErrorAt = now;
					console.error("[ZEBU] database not ready yet", e);
				}
			} else {
			console.error("[ZEBU] executePendingBatch error", e);
			}
	} finally {
			inFlight = false;
	}
}, intervalMs);

// ── Intraday auto-close at 15:25 IST (5 min before NSE close) ───────────────
// Prevents intraday (MIS/I product) positions from being held overnight.
setInterval(async () => {
	if (!AppDataSource.isInitialized || !schemaReady) return;

	const ist = istNow();
	if (!isWeekday(ist)) { intradayAutoCloseFired = false; return; }

	const h = ist.getUTCHours();
	const m = ist.getUTCMinutes();
	const min = h * 60 + m;

	// Reset flag at midnight IST each day
	if (min < 1) { intradayAutoCloseFired = false; return; }

	// Fire once between 15:25 and 15:30 IST
	const CUTOFF = 15 * 60 + 25;
	const MARKET_CLOSE = 15 * 60 + 30;
	if (min >= CUTOFF && min < MARKET_CLOSE && !intradayAutoCloseFired) {
		intradayAutoCloseFired = true;
		try {
			const result = await zebu.closeAllIntradayPositions();
			console.log("[ZEBU] Auto-closed intraday positions at 15:25 IST", result);
		} catch (e) {
			console.error("[ZEBU] Auto-close intraday error", e);
		}
	}
}, 60_000); // check every minute
