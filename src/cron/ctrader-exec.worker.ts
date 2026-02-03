import { CTraderService } from "../app/cTraderListener/services/cTrader";

const ctrader = new CTraderService({
  baseUrl: process.env.CTRADER_GATEWAY_URL,
  timeoutMs: Number(process.env.CTRADER_HEALTH_TIMEOUT_MS ?? 5000),
});

const intervalMs = Number(process.env.CTRADER_EXEC_INTERVAL_MS ?? 500);
const batchSize = Number(process.env.CTRADER_EXEC_BATCH_SIZE ?? 25);

let inFlight = false;

setInterval(async () => {
  if (inFlight) return;
  inFlight = true;

  try {
    await ctrader.executePendingBatch({ batchSize });
  } catch (e) {
    console.error("[CTRADER] executePendingBatch error", e);
  } finally {
    inFlight = false;
  }
}, intervalMs);
