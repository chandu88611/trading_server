"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrokerCredentialService = void 0;
const brokerCredential_db_1 = require("../db/brokerCredential.db");
class BrokerCredentialService {
    constructor() {
        this.db = new brokerCredential_db_1.BrokerCredentialDB();
    }
    async create(payload) {
        return await this.db.create(payload);
    }
    async getCredentialIdByUserId(userId) {
        try {
            return await this.db.getCredentialIdByUserId(userId);
        }
        catch (error) {
            throw error;
        }
    }
    async getTypeOfBrokerByUserId(userId) {
        try {
            const credential = await this.db.getTypeOfBrokerByUserId(userId);
            if (credential && credential.length > 0) {
                return credential;
            }
            else {
                throw new Error("credential_not_found");
            }
        }
        catch (error) {
            throw error;
        }
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
