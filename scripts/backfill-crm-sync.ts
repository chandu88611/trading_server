import "reflect-metadata";
import AppDataSource from "../src/db/data-source";
import { SubscriptionInvoice, User, UserSubscription } from "../src/entity";
import { CrmLifecycleSyncService } from "../src/app/integrations/crm/services/crmLifecycleSync.service";

async function main() {
  await AppDataSource.initialize();
  const crmSync = new CrmLifecycleSyncService();
  await crmSync.ensureSchema();

  const userRepo = AppDataSource.getRepository(User);
  const invoiceRepo = AppDataSource.getRepository(SubscriptionInvoice);
  const subscriptionRepo = AppDataSource.getRepository(UserSubscription);

  const users = await userRepo.find();
  for (const user of users) {
    await crmSync.enqueueEvent({
      eventType: "user.registered",
      userId: Number(user.id),
      occurredAt: user.createdAt,
    });
  }

  const subscriptions = await subscriptionRepo.find();
  for (const subscription of subscriptions) {
    const isExpired =
      subscription.statusV2 === "expired" ||
      (subscription.endDate ? subscription.endDate.getTime() < Date.now() : false);
    await crmSync.enqueueEvent({
      eventType: isExpired ? "subscription.expired" : "subscription.updated",
      userId: Number(subscription.userId),
      subscriptionId: Number(subscription.id),
      occurredAt: subscription.updatedAt || subscription.createdAt,
    });
  }

  const invoices = await invoiceRepo.find();
  for (const invoice of invoices) {
    await crmSync.enqueueEvent({
      eventType: invoice.status === "failed" ? "payment.failed" : "invoice.upserted",
      userId: Number(invoice.userId),
      subscriptionId: invoice.subscriptionId ? Number(invoice.subscriptionId) : null,
      invoiceId: Number(invoice.id),
      occurredAt: invoice.createdAt,
    });
  }

  await crmSync.publishPending(500);
  console.log(
    `[CRM_BACKFILL] queued users=${users.length} subscriptions=${subscriptions.length} invoices=${invoices.length}`
  );
  await AppDataSource.destroy();
}

void main().catch(async (error) => {
  console.error("[CRM_BACKFILL] failed", error);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
