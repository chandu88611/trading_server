import cron from "node-cron";
import AppDataSource from "../db/data-source";
import { BrokerInstrumentService } from "../app/india/options/brokerInstrument.service";

const service = new BrokerInstrumentService();
let inFlight = false;

async function runSync(force = false) {
  if (inFlight || !AppDataSource.isInitialized) return;
  inFlight = true;
  try {
    const result = force ? await service.sync() : await service.syncIfStale();
    console.log("[ZEBU_INSTRUMENT_SYNC]", result);
  } catch (error) {
    console.error("[ZEBU_INSTRUMENT_SYNC] failed", error);
  } finally {
    inFlight = false;
  }
}

cron.schedule("0 8 * * *", () => void runSync(true), {
  timezone: "Asia/Kolkata",
});

void runSync();
