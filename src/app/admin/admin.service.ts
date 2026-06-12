import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import AppDataSource from "../../db/data-source";
import { HttpStatusCode } from "../../types/constants";

type JsonRecord = Record<string, any>;

function badRequest(message: string) {
  return { statusCode: HttpStatusCode._BAD_REQUEST, message };
}

function toPositiveInt(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function toOffset(value: unknown) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

function parseJsonObject(value: unknown, fallback: JsonRecord = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  return value as JsonRecord;
}

function normalizeBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
}

function normalizeText(value: unknown, fieldName: string, required = false) {
  const text = String(value ?? "").trim();
  if (required && !text) throw badRequest(`${fieldName}_required`);
  return text;
}

export class AdminService {
  async ensureSchema() {
    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS admin_settings (
        id INT PRIMARY KEY DEFAULT 1,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        logo_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS admin_api_keys (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS admin_email_templates (
        template_key TEXT PRIMARY KEY,
        subject TEXT NOT NULL DEFAULT '',
        body_html TEXT NOT NULL DEFAULT '',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS admin_risk_rules (
        id INT PRIMARY KEY DEFAULT 1,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS admin_copy_settings (
        id INT PRIMARY KEY DEFAULT 1,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS admin_fanout_settings (
        id INT PRIMARY KEY DEFAULT 1,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS admin_copy_strategy_links (
        id BIGSERIAL PRIMARY KEY,
        strategy_id BIGINT NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
        master_account_id BIGINT NOT NULL REFERENCES user_trading_accounts(id) ON DELETE CASCADE,
        plan_id BIGINT REFERENCES subscription_plans(id) ON DELETE SET NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(strategy_id, master_account_id)
      );
    `);

    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id BIGSERIAL PRIMARY KEY,
        actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        ip TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS error_events (
        id BIGSERIAL PRIMARY KEY,
        service TEXT NOT NULL DEFAULT 'trading_server',
        severity TEXT NOT NULL DEFAULT 'error',
        message TEXT NOT NULL,
        stack TEXT,
        route TEXT,
        method TEXT,
        actor_user_id BIGINT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS admin_vps_nodes (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT,
        region TEXT,
        status TEXT NOT NULL DEFAULT 'unknown',
        cpu_load NUMERIC(8,2),
        memory_used_mb INT,
        memory_total_mb INT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS broker_jobs (
        id BIGSERIAL PRIMARY KEY,
        credential_id BIGINT NOT NULL,
        type TEXT NOT NULL,
        payload JSONB,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INT NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_broker_jobs_status_created_at
      ON broker_jobs(status, created_at);
    `);

    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
      ON admin_audit_logs(created_at DESC);
    `);

    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_error_events_created_at
      ON error_events(created_at DESC);
    `);
  }

  async recordAudit(args: {
    actorUserId?: number | null;
    action: string;
    entityType?: string | null;
    entityId?: string | number | null;
    metadata?: JsonRecord;
    ip?: string | null;
    userAgent?: string | null;
  }) {
    await AppDataSource.query(
      `
      INSERT INTO admin_audit_logs(actor_user_id, action, entity_type, entity_id, metadata, ip, user_agent)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
      `,
      [
        args.actorUserId ?? null,
        args.action,
        args.entityType ?? null,
        args.entityId === undefined || args.entityId === null ? null : String(args.entityId),
        JSON.stringify(args.metadata ?? {}),
        args.ip ?? null,
        args.userAgent ?? null,
      ]
    );
  }

  async getSettings() {
    await AppDataSource.query(`
      INSERT INTO admin_settings(id, data)
      VALUES (1, '{}'::jsonb)
      ON CONFLICT (id) DO NOTHING
    `);
    const rows = await AppDataSource.query(
      `
      SELECT data, logo_url AS "logoUrl", updated_at AS "updatedAt"
      FROM admin_settings
      WHERE id = 1
      `
    );
    const row = rows?.[0] ?? {};
    return { ...(row.data ?? {}), logoUrl: row.logoUrl ?? row.data?.logoUrl ?? "", updatedAt: row.updatedAt };
  }

  async upsertSettings(body: JsonRecord) {
    const settings = parseJsonObject(body);
    const logoUrl = settings.logoUrl ? String(settings.logoUrl) : null;
    const rows = await AppDataSource.query(
      `
      INSERT INTO admin_settings(id, data, logo_url, updated_at)
      VALUES (1, $1::jsonb, $2, now())
      ON CONFLICT (id) DO UPDATE
      SET data = EXCLUDED.data,
          logo_url = EXCLUDED.logo_url,
          updated_at = now()
      RETURNING data, logo_url AS "logoUrl", updated_at AS "updatedAt"
      `,
      [JSON.stringify(settings), logoUrl]
    );
    const row = rows[0];
    return { ...(row.data ?? {}), logoUrl: row.logoUrl ?? "", updatedAt: row.updatedAt };
  }

  async uploadLogo(body: JsonRecord) {
    const dataUrl = normalizeText(body.dataUrl, "dataUrl", true);
    const filename = normalizeText(body.filename, "filename") || `logo-${Date.now()}`;
    const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw badRequest("unsupported_logo_type");

    const contentType = match[1];
    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length > 2 * 1024 * 1024) throw badRequest("logo_too_large");

    const safeStem = filename
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "logo";
    const uploadDir = path.resolve(process.cwd(), "uploads", "admin");
    await fs.mkdir(uploadDir, { recursive: true });
    const storedName = `${safeStem}-${Date.now()}.${ext}`;
    await fs.writeFile(path.join(uploadDir, storedName), bytes);
    const url = `/uploads/admin/${storedName}`;

    const settings = await this.getSettings();
    await this.upsertSettings({ ...settings, logoUrl: url });
    return { url };
  }

  async listApiKeys() {
    const rows = await AppDataSource.query(`
      SELECT id, name, key_prefix AS "keyPrefix", scopes, is_active AS "isActive",
             last_used_at AS "lastUsedAt", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM admin_api_keys
      ORDER BY created_at DESC
    `);
    return rows;
  }

  async createApiKey(body: JsonRecord) {
    const name = normalizeText(body.name, "name", true);
    const scopes = Array.isArray(body.scopes) ? body.scopes : [];
    const token = `tb_${crypto.randomBytes(24).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(token).digest("hex");
    const keyPrefix = token.slice(0, 10);
    const rows = await AppDataSource.query(
      `
      INSERT INTO admin_api_keys(name, key_prefix, key_hash, scopes)
      VALUES ($1, $2, $3, $4::jsonb)
      RETURNING id, name, key_prefix AS "keyPrefix", scopes, is_active AS "isActive", created_at AS "createdAt"
      `,
      [name, keyPrefix, keyHash, JSON.stringify(scopes)]
    );
    return { ...rows[0], token };
  }

  async deleteApiKey(id: number) {
    const rows = await AppDataSource.query(
      `
      UPDATE admin_api_keys
      SET is_active = false, updated_at = now()
      WHERE id = $1
      RETURNING id, name, is_active AS "isActive"
      `,
      [id]
    );
    if (!rows[0]) throw { statusCode: HttpStatusCode._NOT_FOUND, message: "api_key_not_found" };
    return rows[0];
  }

  async listEmailTemplates() {
    return AppDataSource.query(`
      SELECT template_key AS "templateKey", subject, body_html AS "bodyHtml", metadata,
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM admin_email_templates
      ORDER BY template_key ASC
    `);
  }

  async sendTestEmail(to: string) {
    const target = String(to ?? "").trim();
    if (!target || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "valid_email_required" };
    }
    const { sendTestEmail } = await import("../../types/email.service");
    return sendTestEmail(target);
  }

  async upsertEmailTemplates(body: JsonRecord) {
    const templates = Array.isArray(body.templates) ? body.templates : [body];
    const saved = [];
    for (const template of templates) {
      const templateKey = normalizeText(template.templateKey ?? template.key, "templateKey", true);
      const subject = normalizeText(template.subject, "subject");
      const bodyHtml = String(template.bodyHtml ?? template.body_html ?? "");
      const metadata = parseJsonObject(template.metadata);
      const rows = await AppDataSource.query(
        `
        INSERT INTO admin_email_templates(template_key, subject, body_html, metadata, updated_at)
        VALUES ($1, $2, $3, $4::jsonb, now())
        ON CONFLICT (template_key) DO UPDATE
        SET subject = EXCLUDED.subject,
            body_html = EXCLUDED.body_html,
            metadata = EXCLUDED.metadata,
            updated_at = now()
        RETURNING template_key AS "templateKey", subject, body_html AS "bodyHtml", metadata, updated_at AS "updatedAt"
        `,
        [templateKey, subject, bodyHtml, JSON.stringify(metadata)]
      );
      saved.push(rows[0]);
    }
    return saved;
  }

  private async getSingleton(table: string) {
    await AppDataSource.query(`
      INSERT INTO ${table}(id, data)
      VALUES (1, '{}'::jsonb)
      ON CONFLICT (id) DO NOTHING
    `);
    const rows = await AppDataSource.query(
      `
      SELECT data, updated_at AS "updatedAt"
      FROM ${table}
      WHERE id = 1
      `
    );
    return rows[0] ?? { data: {}, updatedAt: null };
  }

  private async putSingleton(table: string, body: JsonRecord) {
    const rows = await AppDataSource.query(
      `
      INSERT INTO ${table}(id, data, updated_at)
      VALUES (1, $1::jsonb, now())
      ON CONFLICT (id) DO UPDATE
      SET data = EXCLUDED.data,
          updated_at = now()
      RETURNING data, updated_at AS "updatedAt"
      `,
      [JSON.stringify(parseJsonObject(body))]
    );
    return rows[0];
  }

  getRiskRules() {
    return this.getSingleton("admin_risk_rules");
  }

  putRiskRules(body: JsonRecord) {
    return this.putSingleton("admin_risk_rules", body);
  }

  getCopySettings() {
    return this.getSingleton("admin_copy_settings");
  }

  putCopySettings(body: JsonRecord) {
    return this.putSingleton("admin_copy_settings", body);
  }

  getFanoutSettings() {
    return this.getSingleton("admin_fanout_settings");
  }

  putFanoutSettings(body: JsonRecord) {
    return this.putSingleton("admin_fanout_settings", body);
  }

  async listPayments(query: JsonRecord) {
    const limit = Math.min(toPositiveInt(query.limit, 50), 200);
    const offset = toOffset(query.offset);
    const rows = await AppDataSource.query(
      `
      SELECT p.id, p.invoice_id AS "invoiceId", p.user_id AS "userId",
             u.email AS "userEmail", p.status, p.amount_cents AS "amountCents",
             p.currency, p.gateway, p.gateway_event_id AS "gatewayEventId",
             p.created_at AS "createdAt"
      FROM subscription_payments p
      LEFT JOIN users u ON u.id = p.user_id
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );
    const total = await AppDataSource.query(`SELECT COUNT(*)::int AS count FROM subscription_payments`);
    return { rows, total: Number(total[0]?.count ?? 0), limit, offset };
  }

  async listBrokers() {
    return AppDataSource.query(`
      SELECT id, code, name, market_category AS "marketCategory",
             is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM brokers
      ORDER BY name ASC
    `);
  }

  async createBroker(body: JsonRecord) {
    const code = normalizeText(body.code, "code", true).toUpperCase();
    const name = normalizeText(body.name, "name", true);
    const marketCategory = normalizeText(body.marketCategory ?? body.market_category, "marketCategory", true).toUpperCase();
    const rows = await AppDataSource.query(
      `
      INSERT INTO brokers(code, name, market_category, is_active)
      VALUES ($1, $2, $3, $4)
      RETURNING id, code, name, market_category AS "marketCategory", is_active AS "isActive"
      `,
      [code, name, marketCategory, normalizeBoolean(body.isActive, true)]
    );
    return rows[0];
  }

  async updateBroker(id: number, body: JsonRecord) {
    const existing = await AppDataSource.query(`SELECT * FROM brokers WHERE id = $1`, [id]);
    if (!existing[0]) throw { statusCode: HttpStatusCode._NOT_FOUND, message: "broker_not_found" };
    const rows = await AppDataSource.query(
      `
      UPDATE brokers
      SET code = $2,
          name = $3,
          market_category = $4,
          is_active = $5,
          updated_at = now()
      WHERE id = $1
      RETURNING id, code, name, market_category AS "marketCategory", is_active AS "isActive", updated_at AS "updatedAt"
      `,
      [
        id,
        normalizeText(body.code ?? existing[0].code, "code", true).toUpperCase(),
        normalizeText(body.name ?? existing[0].name, "name", true),
        normalizeText(body.marketCategory ?? body.market_category ?? existing[0].market_category, "marketCategory", true).toUpperCase(),
        normalizeBoolean(body.isActive ?? body.is_active, Boolean(existing[0].is_active)),
      ]
    );
    return rows[0];
  }

  async deleteBroker(id: number) {
    const rows = await AppDataSource.query(
      `
      UPDATE brokers
      SET is_active = false, updated_at = now()
      WHERE id = $1
      RETURNING id, code, name, is_active AS "isActive"
      `,
      [id]
    );
    if (!rows[0]) throw { statusCode: HttpStatusCode._NOT_FOUND, message: "broker_not_found" };
    return rows[0];
  }

  async listVpsNodes() {
    return AppDataSource.query(`
      SELECT n.id, n.name, n.provider, n.region, n.status,
             n.cpu_load AS "cpuLoad", n.memory_used_mb AS "memoryUsedMb",
             n.memory_total_mb AS "memoryTotalMb", n.metadata,
             n.created_at AS "createdAt", n.updated_at AS "updatedAt"
      FROM admin_vps_nodes n
      ORDER BY n.created_at DESC
    `);
  }

  async getVpsNode(id: number) {
    const rows = await AppDataSource.query(
      `
      SELECT n.id, n.name, n.provider, n.region, n.status,
             n.cpu_load AS "cpuLoad", n.memory_used_mb AS "memoryUsedMb",
             n.memory_total_mb AS "memoryTotalMb", n.metadata,
             n.created_at AS "createdAt", n.updated_at AS "updatedAt",
             COALESCE(json_agg(json_build_object(
               'id', a.id,
               'userId', a.user_id,
               'accountId', a.account_id,
               'accountLabel', a.account_label,
               'brokerId', a.broker_id,
               'status', a.status
             )) FILTER (WHERE a.id IS NOT NULL), '[]'::json) AS "attachedAccounts"
      FROM admin_vps_nodes n
      LEFT JOIN user_trading_accounts a
        ON (a.account_meta->>'vpsNodeId')::bigint = n.id
      WHERE n.id = $1
      GROUP BY n.id
      `,
      [id]
    );
    if (!rows[0]) throw { statusCode: HttpStatusCode._NOT_FOUND, message: "vps_node_not_found" };
    return rows[0];
  }

  async listTaskQueue(query: JsonRecord) {
    const limit = Math.min(toPositiveInt(query.limit, 50), 200);
    const rows = await AppDataSource.query(
      `
      SELECT id, credential_id AS "credentialId", type, payload, status,
             attempts, last_error AS "lastError", created_at AS "createdAt",
             updated_at AS "updatedAt"
      FROM broker_jobs
      ORDER BY
        CASE WHEN status = 'pending' THEN 0 WHEN status = 'in_progress' THEN 1 ELSE 2 END,
        created_at DESC
      LIMIT $1
      `,
      [limit]
    );
    const counts = await AppDataSource.query(`
      SELECT status, COUNT(*)::int AS count
      FROM broker_jobs
      GROUP BY status
    `);
    return { rows, counts };
  }

  async listErrors(query: JsonRecord) {
    const limit = Math.min(toPositiveInt(query.limit, 50), 200);
    const offset = toOffset(query.offset);
    const rows = await AppDataSource.query(
      `
      SELECT id, service, severity, message, stack, route, method,
             actor_user_id AS "actorUserId", metadata, created_at AS "createdAt"
      FROM error_events
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );
    return { rows, limit, offset };
  }

  async listAuditLogs(query: JsonRecord) {
    const limit = Math.min(toPositiveInt(query.limit, 50), 200);
    const offset = toOffset(query.offset);
    const rows = await AppDataSource.query(
      `
      SELECT l.id, l.actor_user_id AS "actorUserId", u.email AS "actorEmail",
             l.action, l.entity_type AS "entityType", l.entity_id AS "entityId",
             l.metadata, l.ip, l.user_agent AS "userAgent", l.created_at AS "createdAt"
      FROM admin_audit_logs l
      LEFT JOIN users u ON u.id = l.actor_user_id
      ORDER BY l.created_at DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );
    return { rows, limit, offset };
  }

  async listStrategyLinks() {
    return AppDataSource.query(`
      SELECT l.id, l.strategy_id AS "strategyId", s.name AS "strategyName",
             l.master_account_id AS "masterAccountId", a.account_label AS "masterAccountLabel",
             a.account_id AS "masterBrokerAccountId", l.plan_id AS "planId",
             p.name AS "planName", l.is_active AS "isActive", l.metadata,
             l.created_at AS "createdAt", l.updated_at AS "updatedAt"
      FROM admin_copy_strategy_links l
      LEFT JOIN strategies s ON s.id = l.strategy_id
      LEFT JOIN user_trading_accounts a ON a.id = l.master_account_id
      LEFT JOIN subscription_plans p ON p.id = l.plan_id
      ORDER BY l.created_at DESC
    `);
  }

  async upsertStrategyLink(body: JsonRecord) {
    const strategyId = Number(body.strategyId ?? body.strategy_id);
    const masterAccountId = Number(body.masterAccountId ?? body.master_account_id);
    if (!Number.isInteger(strategyId) || strategyId <= 0) throw badRequest("strategyId_required");
    if (!Number.isInteger(masterAccountId) || masterAccountId <= 0) throw badRequest("masterAccountId_required");
    const planIdRaw = body.planId ?? body.plan_id;
    const planId = planIdRaw === undefined || planIdRaw === null || planIdRaw === "" ? null : Number(planIdRaw);
    const rows = await AppDataSource.query(
      `
      INSERT INTO admin_copy_strategy_links(strategy_id, master_account_id, plan_id, is_active, metadata, updated_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, now())
      ON CONFLICT (strategy_id, master_account_id) DO UPDATE
      SET plan_id = EXCLUDED.plan_id,
          is_active = EXCLUDED.is_active,
          metadata = EXCLUDED.metadata,
          updated_at = now()
      RETURNING id, strategy_id AS "strategyId", master_account_id AS "masterAccountId",
                plan_id AS "planId", is_active AS "isActive", metadata
      `,
      [
        strategyId,
        masterAccountId,
        Number.isFinite(planId) ? planId : null,
        normalizeBoolean(body.isActive ?? body.is_active, true),
        JSON.stringify(parseJsonObject(body.metadata)),
      ]
    );
    return rows[0];
  }

  async listTradingViewAlerts(query: JsonRecord) {
    const limit = Math.min(toPositiveInt(query.limit, 50), 200);
    const rows = await AppDataSource.query(
      `
      SELECT s.id, s.ticker, s.exchange, s.interval, s.alert_time AS "alertTime",
             s.close, s.execution_mode AS "executionMode", s.entry_ref AS "entryRef",
             s.strategy_id AS "strategyId", st.name AS "strategyName",
             s.plan_id AS "planId", p.name AS "planName",
             s.subscription_id AS "subscriptionId", s.user_id AS "userId",
             s.created_at AS "createdAt"
      FROM alert_snapshots s
      LEFT JOIN strategies st ON st.id = s.strategy_id
      LEFT JOIN subscription_plans p ON p.id = s.plan_id
      ORDER BY s.created_at DESC
      LIMIT $1
      `,
      [limit]
    );
    return rows;
  }
}
