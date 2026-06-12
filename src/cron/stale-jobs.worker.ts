import AppDataSource, { ensureAppDataSourceInitialized } from "../db/data-source";
import { Mt5ListenerDBServices } from "../app/mt5Listener/mt5Listener.db";

// EA polls every 1s; ACK round-trip should complete in 2-3s.
// Any job still in_progress after 7s means the EA is offline — reset it immediately.
const STALE_AFTER_SECONDS = Number(process.env.STALE_JOB_RESET_SECONDS ?? 7);
const CHECK_INTERVAL_MS   = Number(process.env.STALE_JOB_CHECK_INTERVAL_MS ?? 5_000);

const dbService = new Mt5ListenerDBServices(AppDataSource);
let lastDbInitErrorAt = 0;

setInterval(async () => {
  try {
    if (!AppDataSource.isInitialized) {
      await ensureAppDataSourceInitialized();
    }
    const reset = await dbService.resetStaleInProgressJobs(STALE_AFTER_SECONDS);
    if (reset > 0) {
      console.log(`[STALE-JOBS] Reset ${reset} stale MT5 in_progress jobs (stale after ${STALE_AFTER_SECONDS}s)`);
    }
  } catch (e) {
    const isDriverNotConnected =
      e instanceof Error && String(e.message ?? "").includes("Driver not Connected");
    if (isDriverNotConnected) {
      const now = Date.now();
      if (now - lastDbInitErrorAt >= 10_000) {
        lastDbInitErrorAt = now;
        console.error("[STALE-JOBS] database not ready yet", e);
      }
    } else {
      console.error("[STALE-JOBS] error resetting stale jobs", e);
    }
  }
}, CHECK_INTERVAL_MS);
