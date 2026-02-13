"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const cTrader_1 = require("../app/cTraderListener/services/cTrader");
const ctrader = new cTrader_1.CTraderService({
    baseUrl: process.env.CTRADER_GATEWAY_URL,
    timeoutMs: Number(process.env.CTRADER_HEALTH_TIMEOUT_MS ?? 5000),
});
node_cron_1.default.schedule("*/1 * * * *", async () => {
    const r = await ctrader.checkConnection();
    if (r.ok) {
        console.log(`[CTRADER] OK ${r.status} ${r.latencyMs}ms`);
    }
    else {
        console.error(`[CTRADER] DOWN ${r.error} ${r.status ?? ""} ${r.latencyMs}ms`, {
            url: r.url,
            payload: r.payload,
        });
    }
});
