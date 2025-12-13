"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrokerSessionService = void 0;
const brokerSession_db_1 = require("../db/brokerSession.db");
class BrokerSessionService {
    constructor() {
        this.db = new brokerSession_db_1.BrokerSessionDB();
    }
    async create(payload) {
        return this.db.create(payload);
    }
    async update(id, payload) {
        return this.db.update(id, payload);
    }
    async getValidSessions(credentialId) {
        return this.db.getValidByCredential(credentialId);
    }
    async revokeAll(credentialId) {
        return this.db.revokeAllForCredential(credentialId);
    }
}
exports.BrokerSessionService = BrokerSessionService;
