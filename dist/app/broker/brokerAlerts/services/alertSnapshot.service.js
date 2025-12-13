"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertSnapshotService = void 0;
const alertSnapshot_db_1 = require("../db/alertSnapshot.db");
class AlertSnapshotService {
    constructor() {
        this.db = new alertSnapshot_db_1.AlertSnapshotDB();
    }
    async create(payload) {
        return this.db.create(payload);
    }
    async listByJob(jobId) {
        return this.db.listByJob(jobId);
    }
}
exports.AlertSnapshotService = AlertSnapshotService;
