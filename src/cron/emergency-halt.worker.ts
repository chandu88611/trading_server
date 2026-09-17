import AppDataSource from "../db/data-source";
import { EmergencyHaltService } from "../app/trade/services/emergencyHalt.service";
let busy = false;
setInterval(async () => {
  if (busy || !AppDataSource.isInitialized) return;
  busy = true;
  try { await new EmergencyHaltService().processPending(); }
  catch (error) { console.error("[HALT] cleanup failed", error); }
  finally { busy = false; }
}, 5000).unref();
