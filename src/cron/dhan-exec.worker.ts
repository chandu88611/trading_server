import { UpstoxService } from "../app/upstox/services/upstox.service";
import AppDataSource, { ensureAppDataSourceInitialized } from "../db/data-source";
import { DhanService } from "../app/dhan/services/dhan.service";

const dhan = new DhanService();

const intervalMs = Number(process.env.DHAN_EXEC_INTERVAL_MS ?? 500);
const batchSize = Number(process.env.DHAN_EXEC_BATCH_SIZE ?? 25);

let inFlight = false;
let lastDbInitErrorAt = 0;

setInterval(async () => {
	if (inFlight) return;
	inFlight = true;

	try {
			if (!AppDataSource.isInitialized) {
				await ensureAppDataSourceInitialized();
			}
			await dhan.executePendingBatch({ batchSize });
            await new UpstoxService().executePendingBatch({ batchSize });
	} catch (e) {
			const isDriverNotConnected =
				e instanceof Error && String(e.message || "").includes("Driver not Connected");
			if (isDriverNotConnected) {
				const now = Date.now();
				if (now - lastDbInitErrorAt >= 10000) {
					lastDbInitErrorAt = now;
					console.error("[DHAN] database not ready yet", e);
				}
			} else {
			console.error("[DHAN] executePendingBatch error", e);
			}
	} finally {
			inFlight = false;
	}
}, intervalMs);
