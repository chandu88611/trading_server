"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrokerSessionDB = void 0;
const data_source_1 = __importDefault(require("../../../../db/data-source"));
const entity_1 = require("../../../../entity");
class BrokerSessionDB {
    constructor() {
        this.repo = data_source_1.default.getRepository(entity_1.BrokerSession);
        this.credRepo = data_source_1.default.getRepository(entity_1.BrokerCredential);
    }
    async create(payload) {
        const cred = await this.credRepo.findOne({ where: { id: payload.credentialId } });
        if (!cred)
            throw new Error("credential_not_found");
        const s = this.repo.create({
            credential: { id: payload.credentialId },
            sessionToken: payload.sessionToken ?? null,
            expiresAt: payload.expiresAt ?? null,
            lastRefreshedAt: payload.lastRefreshedAt ?? null,
            status: "valid",
        });
        return this.repo.save(s);
    }
    async update(id, payload) {
        await this.repo.update({ id }, {
            sessionToken: payload.sessionToken,
            expiresAt: payload.expiresAt,
            lastRefreshedAt: payload.lastRefreshedAt,
            status: payload.status,
        });
        return this.repo.findOne({ where: { id } });
    }
    async getValidByCredential(credentialId) {
        return this.repo.find({ where: { credential: { id: credentialId }, status: "valid" } });
    }
    async revokeAllForCredential(credentialId) {
        await this.repo.update({ credential: { id: credentialId } }, { status: "revoked" });
    }
}
exports.BrokerSessionDB = BrokerSessionDB;
