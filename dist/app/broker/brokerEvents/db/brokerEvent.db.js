"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrokerEventDB = void 0;
const data_source_1 = __importDefault(require("../../../../db/data-source"));
const entity_1 = require("../../../../entity");
class BrokerEventDB {
    constructor() {
        this.repo = data_source_1.default.getRepository(entity_1.BrokerEvent);
        this.jobRepo = data_source_1.default.getRepository(entity_1.BrokerJob);
    }
    async create(payload) {
        const job = await this.jobRepo.findOne({ where: { id: payload.jobId } });
        if (!job)
            throw new Error("job_not_found");
        const e = this.repo.create({
            job: { id: payload.jobId },
            eventType: payload.eventType,
            payload: payload.payload ?? null,
        });
        return this.repo.save(e);
    }
    async listByJob(jobId) {
        return this.repo.find({ where: { job: { id: jobId } }, order: { createdAt: "ASC" } });
    }
}
exports.BrokerEventDB = BrokerEventDB;
