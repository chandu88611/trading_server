import AppDataSource, { ensureAppDataSourceInitialized } from "../db/data-source";
import { CoinDCXService } from "../app/coindcx/services/coindcx.service";

const coindcx = new CoinDCXService();

const intervalMs = Number(process.env.COINDCX_EXEC_INTERVAL_MS ?? 500);
const batchSize = Number(process.env.COINDCX_EXEC_BATCH_SIZE ?? 25);

let inFlight = false;
let lastDbInitErrorAt = 0;

setInterval(async () => {
	if (inFlight) return;	
	inFlight = true;

	try {
			if (!AppDataSource.isInitialized) {
				await ensureAppDataSourceInitialized();
			}
			await coindcx.executePendingBatch({ batchSize });
	} catch (e) {
			const isDriverNotConnected =
				e instanceof Error && String(e.message || "").includes("Driver not Connected");
			if (isDriverNotConnected) {
				const now = Date.now();
				if (now - lastDbInitErrorAt >= 10000) {
					lastDbInitErrorAt = now;
					console.error("[COINDCX] database not ready yet", e);
				}
			} else {
			console.error("[COINDCX] executePendingBatch error", e);
			}
	} finally {
			inFlight = false;
	}
}, intervalMs);
