"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrokerEventService = void 0;
const brokerEvent_db_1 = require("../db/brokerEvent.db");
class BrokerEventService {
    constructor() {
        this.db = new brokerEvent_db_1.BrokerEventDB();
    }
    async create(payload) {
        return this.db.create(payload);
    }
    async listByJob(jobId) {
        return this.db.listByJob(jobId);
    }
}
exports.BrokerEventService = BrokerEventService;
