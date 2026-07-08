import { DeltaService } from "../app/deltaExchange/services/delta.service";
import AppDataSource, { ensureAppDataSourceInitialized } from "../db/data-source";

const delta = new DeltaService();

const intervalMs = Number(process.env.DELTA_EXEC_INTERVAL_MS ?? 500);
const batchSize = Number(process.env.DELTA_EXEC_BATCH_SIZE ?? 25);

let inFlight = false;
let lastDbInitErrorAt = 0;
let schemaReady = false;

async function ensureReady() {
	if (!AppDataSource.isInitialized) {
		await ensureAppDataSourceInitialized();
	}

	schemaReady = true;
}

setInterval(async () => {
	if (inFlight) return;

	inFlight = true;

	try {
		await ensureReady();

		if (!schemaReady) return;

		// Delta crypto derivatives are 24/7. Do not use NSE/MCX market timing here.
		await delta.executePendingBatch({ batchSize });
	} catch (e) {
		const isDriverNotConnected =
			e instanceof Error &&
			String(e.message || "").includes("Driver not Connected");

		if (isDriverNotConnected) {
			const now = Date.now();

			if (now - lastDbInitErrorAt >= 10_000) {
				lastDbInitErrorAt = now;
				console.error("[DELTA] database not ready yet", e);
			}
		} else {
			console.error("[DELTA] executePendingBatch error", e);
		}
	} finally {
		inFlight = false;
	}
}, intervalMs);