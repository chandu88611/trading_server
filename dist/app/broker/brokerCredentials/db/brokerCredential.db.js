"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrokerCredentialDB = void 0;
const data_source_1 = __importDefault(require("../../../../db/data-source"));
const entity_1 = require("../../../../entity");
class BrokerCredentialDB {
    constructor() {
        this.repo = data_source_1.default.getRepository(entity_1.BrokerCredential);
        this.userRepo = data_source_1.default.getRepository(entity_1.User);
    }
    async create(payload) {
        const user = await this.userRepo.findOne({ where: { id: payload.userId } });
        if (!user)
            throw new Error("user_not_found");
        const record = this.repo.create({
            user: { id: payload.userId },
            keyName: payload.keyName ?? null,
            encApiKey: payload.encApiKey ?? null,
            encApiSecret: payload.encApiSecret ?? null,
            encRequestToken: payload.encRequestToken ?? null,
            status: payload.status ?? "active",
        });
        return this.repo.save(record);
    }
    async getById(id) {
        return this.repo.findOne({ where: { id }, relations: ["user"] });
    }
    async listByUser(userId) {
        return this.repo.find({ where: { user: { id: userId } }, order: { createdAt: "DESC" } });
    }
    async update(id, payload) {
        await this.repo.update({ id }, {
            keyName: payload.keyName,
            encApiKey: payload.encApiKey,
            encApiSecret: payload.encApiSecret,
            encRequestToken: payload.encRequestToken,
            status: payload.status,
        });
        return this.getById(id);
    }
    async delete(id) {
        return this.repo.delete({ id });
    }
}
exports.BrokerCredentialDB = BrokerCredentialDB;
