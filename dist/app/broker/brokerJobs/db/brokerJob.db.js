"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrokerJobDB = void 0;
const data_source_1 = __importDefault(require("../../../../db/data-source"));
function managerFor(queryRunner) {
    return queryRunner?.manager ?? data_source_1.default;
}
class BrokerJobDB {
    async ensureSchema(queryRunner) {
        await managerFor(queryRunner).query(`
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
      )
    `);
        await managerFor(queryRunner).query(`
      CREATE INDEX IF NOT EXISTS idx_broker_jobs_status_created_at
      ON broker_jobs(status, created_at)
    `);
        await managerFor(queryRunner).query(`
      CREATE INDEX IF NOT EXISTS idx_broker_jobs_credential_type_status
      ON broker_jobs(credential_id, type, status)
    `);
    }
    selectSql() {
        return `
      SELECT id, credential_id AS "credentialId", type, payload, status,
             attempts, last_error AS "lastError",
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM broker_jobs
    `;
    }
    async getOrCreateBrokerJobId(payload, queryRunner) {
        await this.ensureSchema(queryRunner);
        const db = managerFor(queryRunner);
        const existing = await db.query(`
      SELECT id
      FROM broker_jobs
      WHERE credential_id = $1
        AND type = $2
        AND status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
      `, [payload.credentialId, payload.type]);
        if (existing[0]) {
            return Number(existing[0].id);
        }
        const rows = await db.query(`
      INSERT INTO broker_jobs(credential_id, type, payload)
      VALUES ($1, $2, $3::jsonb)
      RETURNING id
      `, [payload.credentialId, payload.type, JSON.stringify(payload.payload ?? null)]);
        return Number(rows[0].id);
    }
    async create(payload) {
        await this.ensureSchema();
        const rows = await data_source_1.default.query(`
      INSERT INTO broker_jobs(credential_id, type, payload)
      VALUES ($1, $2, $3::jsonb)
      RETURNING id, credential_id AS "credentialId", type, payload, status,
                attempts, last_error AS "lastError",
                created_at AS "createdAt", updated_at AS "updatedAt"
      `, [payload.credentialId, payload.type, JSON.stringify(payload.payload ?? null)]);
        return rows[0];
    }
    async update(id, payload) {
        await this.ensureSchema();
        const rows = await data_source_1.default.query(`
      UPDATE broker_jobs
      SET payload = COALESCE($2::jsonb, payload),
          attempts = COALESCE($3::int, attempts),
          last_error = CASE WHEN $4::text IS NULL THEN last_error ELSE $4::text END,
          status = COALESCE($5::text, status),
          updated_at = now()
      WHERE id = $1
      RETURNING id, credential_id AS "credentialId", type, payload, status,
                attempts, last_error AS "lastError",
                created_at AS "createdAt", updated_at AS "updatedAt"
      `, [
            id,
            payload.payload === undefined ? null : JSON.stringify(payload.payload),
            payload.attempts ?? null,
            payload.lastError === undefined ? null : payload.lastError,
            payload.status ?? null,
        ]);
        return rows[0] ?? null;
    }
    async getById(id) {
        await this.ensureSchema();
        const rows = await data_source_1.default.query(`${this.selectSql()} WHERE id = $1`, [id]);
        return rows[0] ?? null;
    }
    async listByCredential(credentialId) {
        await this.ensureSchema();
        return data_source_1.default.query(`${this.selectSql()} WHERE credential_id = $1 ORDER BY created_at DESC`, [credentialId]);
    }
    async listPending(limit = 50) {
        await this.ensureSchema();
        return data_source_1.default.query(`${this.selectSql()} WHERE status = 'pending' ORDER BY created_at ASC LIMIT $1`, [limit]);
    }
}
exports.BrokerJobDB = BrokerJobDB;
