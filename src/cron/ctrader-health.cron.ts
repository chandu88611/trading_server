import cron from "node-cron";
import { CTraderService } from "../app/cTraderListener/services/cTrader";

const ctrader = new CTraderService({
  baseUrl: process.env.CTRADER_GATEWAY_URL,
  healthTimeoutMs: Number(process.env.CTRADER_HEALTH_TIMEOUT_MS ?? 5000),
  requestTimeoutMs: Number(process.env.CTRADER_EXEC_TIMEOUT_MS ?? process.env.CTRADER_REQUEST_TIMEOUT_MS ?? 15000),
});

cron.schedule("*/1 * * * *", async () => {
  const r = await ctrader.checkConnection();

  if (r.ok) {
    console.log(`[CTRADER] OK ${r.status} ${r.latencyMs}ms`);
  } else {
    console.error(`[CTRADER] DOWN ${r.error} ${r.status ?? ""} ${r.latencyMs}ms`, {
      url: r.url,
      payload: r.payload,
    });
  }
});
