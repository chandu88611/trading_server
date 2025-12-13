"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrokerJobService = void 0;
const brokerJob_db_1 = require("../db/brokerJob.db");
class BrokerJobService {
    constructor() {
        this.db = new brokerJob_db_1.BrokerJobDB();
    }
    async create(payload) {
        return this.db.create(payload);
    }
    async update(id, payload) {
        return this.db.update(id, payload);
    }
    async getById(id) {
        return this.db.getById(id);
    }
    async listByCredential(credentialId) {
        return this.db.listByCredential(credentialId);
    }
    async listPending(limit = 50) {
        return this.db.listPending(limit);
    }
    async markInProgress(id, attempts) {
        return this.db.update(id, { status: "in_progress", attempts });
    }
    async markCompleted(id) {
        return this.db.update(id, { status: "completed" });
    }
    async markFailed(id, error, attempts, maxAttempts) {
        const status = attempts >= maxAttempts ? "failed" : "pending";
        return this.db.update(id, {
            status,
            lastError: error,
            attempts
        });
    }
}
exports.BrokerJobService = BrokerJobService;
