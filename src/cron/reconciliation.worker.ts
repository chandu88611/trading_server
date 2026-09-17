import AppDataSource from "../db/data-source";
import { ReconciliationService } from "../app/trade/services/reconciliation.service";
let busy = false;
setInterval(async () => {
  if (busy || !AppDataSource.isInitialized) return;
  busy = true;
  try { await new ReconciliationService().run(); }
  catch (error) { console.error("[RECONCILE] failed", error); }
  finally { busy = false; }
}, 30000).unref();
