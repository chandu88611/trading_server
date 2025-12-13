"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrokerCredentialService = void 0;
const brokerCredential_db_1 = require("../db/brokerCredential.db");
class BrokerCredentialService {
    constructor() {
        this.db = new brokerCredential_db_1.BrokerCredentialDB();
    }
    async create(payload) {
        // encryption/validation could be added here
        return this.db.create(payload);
    }
    async get(id) {
        return this.db.getById(id);
    }
    async listByUser(userId) {
        return this.db.listByUser(userId);
    }
    async update(id, payload) {
        return this.db.update(id, payload);
    }
    async delete(id) {
        return this.db.delete(id);
    }
}
exports.BrokerCredentialService = BrokerCredentialService;
