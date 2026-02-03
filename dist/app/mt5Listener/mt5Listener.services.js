"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mt5ListenerServices = void 0;
class Mt5ListenerServices {
    constructor(dbService) {
        this.dbService = dbService;
    }
    async getSignalForEA(brokerAccountId) {
        const job = await this.dbService.getNextPendingJob(brokerAccountId);
        if (!job)
            return {}; // EA ignores
        await this.dbService.markJobInProgress(job.job_id);
        return {
            ackId: job.job_id, // monotonic
            side: String(job.side).toLowerCase(), // buy/sell
            symbol: job.symbol,
            qty: Number(job.qty) || 0,
        };
    }
    async handleAck(ack) {
        const { ackId, status, message } = ack;
        if (!ackId)
            return;
        if (status === "success") {
            await this.dbService.markJobSuccess(ackId);
        }
        else {
            await this.dbService.markJobFailed(ackId, message || "unknown");
        }
    }
}
exports.Mt5ListenerServices = Mt5ListenerServices;
