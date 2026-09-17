import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { ControllerError } from "../../types/error-handler";
import { HttpStatusCode } from "../../types/constants";
import { AdminService } from "./admin.service";

function parseId(value: unknown, name: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw { statusCode: HttpStatusCode._BAD_REQUEST, message: `invalid_${name}` };
  }
  return id;
}

function auditContext(req: AuthRequest) {
  return {
    actorUserId: req.auth?.userId ? Number(req.auth.userId) : null,
    ip: req.ip,
    userAgent: req.headers["user-agent"] ? String(req.headers["user-agent"]) : null,
  };
}

export class AdminController {
  private service = new AdminService();

  @ControllerError()
  async getTradingAccount(req: AuthRequest, res: Response) {
    res.json({data:await this.service.getTradingAccount(parseId(req.params.id,"account_id"))});
  }

  @ControllerError()
  async toggleTradingAccount(req: AuthRequest, res: Response) {
    const id = parseId(req.params.id,"account_id");
    const data = await this.service.toggleTradingAccount(id,req.body?.isEnabled);
    await this.service.recordAudit({...auditContext(req),action:"admin.account.execution",entityType:"trading_account",entityId:id,metadata:{isEnabled:data.isEnabled}});
    res.json({data});
  }

  @ControllerError()
  async listLiveTrades(req: AuthRequest, res: Response) {
    res.json({ data: await this.service.listLiveTrades(req.query ?? {}) });
  }

  @ControllerError()
  async listBrokerAccounts(req: AuthRequest, res: Response) {
    res.json({ data: await this.service.listBrokerAccounts(parseId(req.params.id, "broker_id")) });
  }

  @ControllerError()
  async getSettings(_req: AuthRequest, res: Response) {
    res.json({ message: "admin_settings", data: await this.service.getSettings() });
  }

  @ControllerError()
  async upsertSettings(req: AuthRequest, res: Response) {
    const data = await this.service.upsertSettings(req.body ?? {});
    await this.service.recordAudit({
      ...auditContext(req),
      action: "admin.settings.update",
      entityType: "admin_settings",
      entityId: 1,
    });
    res.json({ message: "admin_settings_updated", data });
  }

  @ControllerError()
  async uploadLogo(req: AuthRequest, res: Response) {
    const data = await this.service.uploadLogo(req.body ?? {});
    await this.service.recordAudit({
      ...auditContext(req),
      action: "admin.settings.logo_upload",
      entityType: "admin_settings",
      entityId: 1,
      metadata: data,
    });
    res.status(201).json(data);
  }

  @ControllerError()
  async listApiKeys(_req: AuthRequest, res: Response) {
    res.json({ message: "admin_api_keys", data: await this.service.listApiKeys() });
  }

  @ControllerError()
  async createApiKey(req: AuthRequest, res: Response) {
    const data = await this.service.createApiKey(req.body ?? {});
    await this.service.recordAudit({
      ...auditContext(req),
      action: "admin.api_key.create",
      entityType: "admin_api_key",
      entityId: data.id,
      metadata: { name: data.name, keyPrefix: data.keyPrefix },
    });
    res.status(201).json({ message: "admin_api_key_created", data });
  }

  @ControllerError()
  async deleteApiKey(req: AuthRequest, res: Response) {
    const id = parseId(req.params.id, "api_key_id");
    const data = await this.service.deleteApiKey(id);
    await this.service.recordAudit({
      ...auditContext(req),
      action: "admin.api_key.delete",
      entityType: "admin_api_key",
      entityId: id,
    });
    res.json({ message: "admin_api_key_deleted", data });
  }

  @ControllerError()
  async listEmailTemplates(_req: AuthRequest, res: Response) {
    res.json({ message: "admin_email_templates", data: await this.service.listEmailTemplates() });
  }

  @ControllerError()
  async upsertEmailTemplates(req: AuthRequest, res: Response) {
    const data = await this.service.upsertEmailTemplates(req.body ?? {});
    await this.service.recordAudit({
      ...auditContext(req),
      action: "admin.email_templates.update",
      entityType: "admin_email_template",
      metadata: { count: data.length },
    });
    res.json({ message: "admin_email_templates_updated", data });
  }

  @ControllerError()
  async sendTestEmail(req: AuthRequest, res: Response) {
    const to = String((req.body as any)?.to ?? "").trim();
    const result = await this.service.sendTestEmail(to);
    await this.service.recordAudit({
      ...auditContext(req),
      action: "admin.email.test_send",
      entityType: "admin_email_template",
      metadata: { to, ok: result.ok, enabled: result.enabled },
    });
    res.json({ message: "admin_email_test", data: result });
  }

  @ControllerError()
  async getRiskRules(_req: AuthRequest, res: Response) {
    res.json({ message: "admin_risk_rules", data: await this.service.getRiskRules() });
  }

  @ControllerError()
  async putRiskRules(req: AuthRequest, res: Response) {
    const data = await this.service.putRiskRules(req.body ?? {});
    await this.service.recordAudit({
      ...auditContext(req),
      action: "admin.risk_rules.update",
      entityType: "admin_risk_rules",
      entityId: 1,
    });
    res.json({ message: "admin_risk_rules_updated", data });
  }

  @ControllerError()
  async listPayments(req: AuthRequest, res: Response) {
    res.json({ message: "admin_payments", data: await this.service.listPayments(req.query ?? {}) });
  }

  @ControllerError()
  async listBrokers(_req: AuthRequest, res: Response) {
    res.json({ message: "admin_brokers", data: await this.service.listBrokers() });
  }

  @ControllerError()
  async createBroker(req: AuthRequest, res: Response) {
    const data = await this.service.createBroker(req.body ?? {});
    await this.service.recordAudit({
      ...auditContext(req),
      action: "admin.broker.create",
      entityType: "broker",
      entityId: data.id,
      metadata: { code: data.code },
    });
    res.status(201).json({ message: "admin_broker_created", data });
  }

  @ControllerError()
  async updateBroker(req: AuthRequest, res: Response) {
    const id = parseId(req.params.id, "broker_id");
    const data = await this.service.updateBroker(id, req.body ?? {});
    await this.service.recordAudit({
      ...auditContext(req),
      action: "admin.broker.update",
      entityType: "broker",
      entityId: id,
    });
    res.json({ message: "admin_broker_updated", data });
  }

  @ControllerError()
  async deleteBroker(req: AuthRequest, res: Response) {
    const id = parseId(req.params.id, "broker_id");
    const data = await this.service.deleteBroker(id);
    await this.service.recordAudit({
      ...auditContext(req),
      action: "admin.broker.delete",
      entityType: "broker",
      entityId: id,
    });
    res.json({ message: "admin_broker_deleted", data });
  }

  @ControllerError()
  async listVpsNodes(_req: AuthRequest, res: Response) {
    res.json({ message: "admin_vps_nodes", data: await this.service.listVpsNodes() });
  }

  @ControllerError()
  async getVpsNode(req: AuthRequest, res: Response) {
    const id = parseId(req.params.id, "vps_node_id");
    res.json({ message: "admin_vps_node", data: await this.service.getVpsNode(id) });
  }

  @ControllerError()
  async listTaskQueue(req: AuthRequest, res: Response) {
    res.json({ message: "admin_task_queue", data: await this.service.listTaskQueue(req.query ?? {}) });
  }

  @ControllerError()
  async listErrors(req: AuthRequest, res: Response) {
    res.json({ message: "admin_errors", data: await this.service.listErrors(req.query ?? {}) });
  }

  @ControllerError()
  async listAuditLogs(req: AuthRequest, res: Response) {
    res.json({ message: "admin_audit_logs", data: await this.service.listAuditLogs(req.query ?? {}) });
  }

  @ControllerError()
  async getCopySettings(_req: AuthRequest, res: Response) {
    res.json({ message: "admin_copy_settings", data: await this.service.getCopySettings() });
  }

  @ControllerError()
  async putCopySettings(req: AuthRequest, res: Response) {
    const data = await this.service.putCopySettings(req.body ?? {});
    await this.service.recordAudit({
      ...auditContext(req),
      action: "admin.copy_settings.update",
      entityType: "admin_copy_settings",
      entityId: 1,
    });
    res.json({ message: "admin_copy_settings_updated", data });
  }

  @ControllerError()
  async getFanoutSettings(_req: AuthRequest, res: Response) {
    res.json({ message: "admin_fanout_settings", data: await this.service.getFanoutSettings() });
  }

  @ControllerError()
  async putFanoutSettings(req: AuthRequest, res: Response) {
    const data = await this.service.putFanoutSettings(req.body ?? {});
    await this.service.recordAudit({
      ...auditContext(req),
      action: "admin.fanout_settings.update",
      entityType: "admin_fanout_settings",
      entityId: 1,
    });
    res.json({ message: "admin_fanout_settings_updated", data });
  }

  @ControllerError()
  async listStrategyLinks(_req: AuthRequest, res: Response) {
    res.json({ message: "admin_copy_strategy_links", data: await this.service.listStrategyLinks() });
  }

  @ControllerError()
  async upsertStrategyLink(req: AuthRequest, res: Response) {
    const data = await this.service.upsertStrategyLink(req.body ?? {});
    await this.service.recordAudit({
      ...auditContext(req),
      action: "admin.copy_strategy_link.upsert",
      entityType: "admin_copy_strategy_link",
      entityId: data.id,
      metadata: data,
    });
    res.status(201).json({ message: "admin_copy_strategy_link_saved", data });
  }

  @ControllerError()
  async listTradingViewAlerts(req: AuthRequest, res: Response) {
    res.json({ message: "admin_tradingview_alerts", data: await this.service.listTradingViewAlerts(req.query ?? {}) });
  }

  @ControllerError()
  async syncBrokerInstruments(req: AuthRequest, res: Response) {
    const data = await this.service.syncBrokerInstruments((req.body as any)?.segments);
    await this.service.recordAudit({
      ...auditContext(req),
      action: "admin.broker_instruments.sync",
      entityType: "broker_instruments",
      metadata: data,
    });
    res.json({ message: "broker_instruments_synced", data });
  }
}
