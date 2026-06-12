import AppDataSource from "../db/data-source";
import { CrmLifecycleSyncService } from "../app/integrations/crm/services/crmLifecycleSync.service";

const crmSyncService = new CrmLifecycleSyncService();

async function tick() {
  if (!AppDataSource.isInitialized) {
    return;
  }

  try {
    await crmSyncService.ensureSchema();
    const expired = await crmSyncService.reconcileExpiredSubscriptions();
    if (expired.length) {
      await crmSyncService.publishPending(50);
      return;
    }
    await crmSyncService.publishPending(25);
  } catch (error) {
    console.error("[CRM_SYNC_CRON] tick failed", error);
  }
}

setInterval(() => {
  void tick();
}, 60 * 1000);

void tick();
