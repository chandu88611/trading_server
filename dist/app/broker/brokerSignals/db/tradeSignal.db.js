"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeSignalDB = void 0;
const data_source_1 = __importDefault(require("../../../../db/data-source"));
const TradeSignals_1 = require("../../../../entity/TradeSignals");
const entity_1 = require("../../../../entity");
class TradeSignalDB {
    constructor() {
        this.repo = data_source_1.default.getRepository(TradeSignals_1.TradeSignal);
        this.jobRepo = data_source_1.default.getRepository(entity_1.BrokerJob);
    }
    async create(payload) {
        const job = await this.jobRepo.findOne({ where: { id: payload.jobId } });
        if (!job)
            throw new Error("job_not_found");
        const entity = this.repo.create({
            brokerJob: { id: payload.jobId },
            action: payload.action,
            symbol: payload.symbol,
            price: payload.price,
            exchange: payload.exchange,
            signalTime: payload.signalTime,
        });
        return this.repo.save(entity);
    }
    async listByJob(jobId) {
        return this.repo.find({ where: { brokerJob: { id: jobId } }, order: { createdAt: "DESC" } });
    }
}
exports.TradeSignalDB = TradeSignalDB;
