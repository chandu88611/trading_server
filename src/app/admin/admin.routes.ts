import { Router } from "express";
import { requireAuth, Roles } from "../../middleware/auth";
import { AdminController } from "./admin.controller";

const router = Router();
const controller = new AdminController();

router.use(requireAuth([Roles.ADMIN]));

router.get("/settings", controller.getSettings.bind(controller));
router.put("/settings", controller.upsertSettings.bind(controller));
router.post("/settings/logo", controller.uploadLogo.bind(controller));

router.get("/api-keys", controller.listApiKeys.bind(controller));
router.post("/api-keys", controller.createApiKey.bind(controller));
router.delete("/api-keys/:id", controller.deleteApiKey.bind(controller));

router.get("/email-templates", controller.listEmailTemplates.bind(controller));
router.put("/email-templates", controller.upsertEmailTemplates.bind(controller));
router.post("/email-templates/test", controller.sendTestEmail.bind(controller));

router.get("/risk-rules", controller.getRiskRules.bind(controller));
router.put("/risk-rules", controller.putRiskRules.bind(controller));

router.get("/payments", controller.listPayments.bind(controller));

router.get("/brokers", controller.listBrokers.bind(controller));
router.post("/brokers", controller.createBroker.bind(controller));
router.patch("/brokers/:id", controller.updateBroker.bind(controller));
router.delete("/brokers/:id", controller.deleteBroker.bind(controller));

router.get("/vps-nodes", controller.listVpsNodes.bind(controller));
router.get("/vps-nodes/:id", controller.getVpsNode.bind(controller));

router.get("/task-queue", controller.listTaskQueue.bind(controller));
router.get("/errors", controller.listErrors.bind(controller));
router.get("/audit-logs", controller.listAuditLogs.bind(controller));

router.get("/copy-settings", controller.getCopySettings.bind(controller));
router.put("/copy-settings", controller.putCopySettings.bind(controller));
router.get("/fanout-settings", controller.getFanoutSettings.bind(controller));
router.put("/fanout-settings", controller.putFanoutSettings.bind(controller));
router.get("/copy/strategy-links", controller.listStrategyLinks.bind(controller));
router.post("/copy/strategy-links", controller.upsertStrategyLink.bind(controller));

router.get("/tradingview/alerts", controller.listTradingViewAlerts.bind(controller));
router.post("/instruments/sync", controller.syncBrokerInstruments.bind(controller));

export default router;
