"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeSignalService = void 0;
const tradeSignal_db_1 = require("../db/tradeSignal.db");
class TradeSignalService {
    constructor() {
        this.db = new tradeSignal_db_1.TradeSignalDB();
    }
    async create(payload) {
        return this.db.create(payload);
    }
    async createTradeSignal(alertData, queryRunner) {
        try {
            return await this.db.createTradeSignal(alertData, queryRunner);
        }
        catch (error) {
            throw error;
        }
    }
    async listByJob(jobId) {
        return this.db.listByJob(jobId);
    }
}
exports.TradeSignalService = TradeSignalService;
