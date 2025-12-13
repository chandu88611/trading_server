"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertSnapshotDB = void 0;
const data_source_1 = __importDefault(require("../../../../db/data-source"));
const AlertSnapshots_1 = require("../../../../entity/AlertSnapshots");
const entity_1 = require("../../../../entity");
class AlertSnapshotDB {
    constructor() {
        this.repo = data_source_1.default.getRepository(AlertSnapshots_1.AlertSnapshot);
        this.jobRepo = data_source_1.default.getRepository(entity_1.BrokerJob);
    }
    async create(payload) {
        const job = await this.jobRepo.findOne({ where: { id: payload.jobId } });
        if (!job)
            throw new Error("job_not_found");
        const entity = this.repo.create({
            brokerJob: { id: payload.jobId },
            ticker: payload.ticker,
            exchange: payload.exchange ?? null,
            interval: payload.interval ?? null,
            barTime: payload.barTime ?? null,
            alertTime: payload.alertTime ?? null,
            open: payload.open ?? null,
            close: payload.close ?? null,
            high: payload.high ?? null,
            low: payload.low ?? null,
            volume: payload.volume ?? null,
            currency: payload.currency ?? null,
            baseCurrency: payload.baseCurrency ?? null,
        });
        return this.repo.save(entity);
    }
    async listByJob(jobId) {
        return this.repo.find({ where: { brokerJob: { id: jobId } }, order: { createdAt: "DESC" } });
    }
}
exports.AlertSnapshotDB = AlertSnapshotDB;
