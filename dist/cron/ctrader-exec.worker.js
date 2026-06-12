"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const data_source_1 = __importStar(require("../db/data-source"));
const cTrader_1 = require("../app/cTraderListener/services/cTrader");
const ctrader = new cTrader_1.CTraderService({
    baseUrl: process.env.CTRADER_GATEWAY_URL,
    healthTimeoutMs: Number(process.env.CTRADER_HEALTH_TIMEOUT_MS ?? 5000),
    requestTimeoutMs: Number(process.env.CTRADER_EXEC_TIMEOUT_MS ?? process.env.CTRADER_REQUEST_TIMEOUT_MS ?? 15000),
});
const intervalMs = Number(process.env.CTRADER_EXEC_INTERVAL_MS ?? 500);
const batchSize = Number(process.env.CTRADER_EXEC_BATCH_SIZE ?? 25);
let inFlight = false;
let lastDbInitErrorAt = 0;
setInterval(async () => {
    if (inFlight)
        return;
    inFlight = true;
    try {
        if (!data_source_1.default.isInitialized) {
            await (0, data_source_1.ensureAppDataSourceInitialized)();
        }
        await ctrader.executePendingBatch({ batchSize });
    }
    catch (e) {
        const isDriverNotConnected = e instanceof Error && String(e.message || "").includes("Driver not Connected");
        if (isDriverNotConnected) {
            const now = Date.now();
            if (now - lastDbInitErrorAt >= 10000) {
                lastDbInitErrorAt = now;
                console.error("[CTRADER] database not ready yet", e);
            }
        }
        else {
            console.error("[CTRADER] executePendingBatch error", e);
        }
    }
    try {
        if (!data_source_1.default.isInitialized) {
            await (0, data_source_1.ensureAppDataSourceInitialized)();
        }
        await ctrader.executeClosePendingBatch({ batchSize });
    }
    catch (e) {
        const isDriverNotConnected = e instanceof Error && String(e.message || "").includes("Driver not Connected");
        if (isDriverNotConnected) {
            const now = Date.now();
            if (now - lastDbInitErrorAt >= 10000) {
                lastDbInitErrorAt = now;
                console.error("[CTRADER] database not ready yet", e);
            }
        }
        else {
            console.error("[CTRADER] executeClosePendingBatch error", e);
        }
    }
    finally {
        inFlight = false;
    }
}, intervalMs);
