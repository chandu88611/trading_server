import AppDataSource, { ensureAppDataSourceInitialized } from "../db/data-source";
import { CTraderService } from "../app/cTraderListener/services/cTrader";

const ctrader = new CTraderService({
  baseUrl: process.env.CTRADER_GATEWAY_URL,
  healthTimeoutMs: Number(process.env.CTRADER_HEALTH_TIMEOUT_MS ?? 5000),
  requestTimeoutMs: Number(process.env.CTRADER_EXEC_TIMEOUT_MS ?? process.env.CTRADER_REQUEST_TIMEOUT_MS ?? 15000),
});

const intervalMs = Number(process.env.CTRADER_EXEC_INTERVAL_MS ?? 500);
const batchSize = Number(process.env.CTRADER_EXEC_BATCH_SIZE ?? 25);

let inFlight = false;
let lastDbInitErrorAt = 0;

setInterval(async () => {
  if (inFlight) return;
  inFlight = true;

  try {
    if (!AppDataSource.isInitialized) {
      await ensureAppDataSourceInitialized();
    }
    await ctrader.executePendingBatch({ batchSize });
  } catch (e) {
    const isDriverNotConnected =
      e instanceof Error && String(e.message || "").includes("Driver not Connected");
    if (isDriverNotConnected) {
      const now = Date.now();
      if (now - lastDbInitErrorAt >= 10000) {
        lastDbInitErrorAt = now;
        console.error("[CTRADER] database not ready yet", e);
      }
    } else {
      console.error("[CTRADER] executePendingBatch error", e);
    }
  }

  try {
    if (!AppDataSource.isInitialized) {
      await ensureAppDataSourceInitialized();
    }
    await ctrader.executeClosePendingBatch({ batchSize });
  } catch (e) {
    const isDriverNotConnected =
      e instanceof Error && String(e.message || "").includes("Driver not Connected");
    if (isDriverNotConnected) {
      const now = Date.now();
      if (now - lastDbInitErrorAt >= 10000) {
        lastDbInitErrorAt = now;
        console.error("[CTRADER] database not ready yet", e);
      }
    } else {
      console.error("[CTRADER] executeClosePendingBatch error", e);
    }
  } finally {
    inFlight = false;
  }
}, intervalMs);
