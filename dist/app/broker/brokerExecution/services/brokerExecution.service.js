"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrokerExecutionService = void 0;
const entity_1 = require("../../../../entity");
const data_source_1 = __importDefault(require("../../../../db/data-source"));
class BrokerExecutionService {
    constructor() {
        this.jobRepo = data_source_1.default.getRepository(entity_1.BrokerJob);
    }
    // claim a pending job (transactional)
    async claimPendingJob() {
        // simple approach: findOne pending oldest and update status to 'in_progress'
        // use queryBuilder to ensure atomicity
        const qb = this.jobRepo.createQueryBuilder();
        const job = await qb
            .setLock("pessimistic_write")
            .where("status = :status", { status: "pending" })
            .orderBy("created_at", "ASC")
            .limit(1)
            .getOne();
        if (!job)
            return null;
        await this.jobRepo.update({ id: job.id }, { status: "in_progress", attempts: job.attempts + 1 });
        return this.jobRepo.findOne({ where: { id: job.id }, relations: ["credential"] });
    }
    async markCompleted(jobId) {
        await this.jobRepo.update({ id: jobId }, { status: "completed" });
    }
    async markFailed(jobId, error, attempts, maxAttempts) {
        const status = attempts >= maxAttempts ? "failed" : "pending";
        await this.jobRepo.update({ id: jobId }, { status, lastError: error, attempts });
    }
    async fetchPendingCount() {
        return this.jobRepo.count({ where: { status: "pending" } });
    }
}
exports.BrokerExecutionService = BrokerExecutionService;
