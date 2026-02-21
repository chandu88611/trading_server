"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mt5ListenerServices = void 0;
class Mt5ListenerServices {
    constructor(dbService) {
        this.dbService = dbService;
    }
    toPositiveInt(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0)
            return null;
        return Math.trunc(parsed);
    }
    async getSignalForEA(brokerAccountId) {
        try {
            const job = await this.dbService.getNextPendingJob(brokerAccountId);
            if (!job)
                return {};
            const currentStatus = String(job.status?.status ?? "").toLowerCase();
            const isCloseJob = currentStatus === "pending_close";
            await this.dbService.markJobInProgress(job);
            if (isCloseJob) {
                const closePayload = {
                    ackId: job.id,
                    side: "close",
                    symbol: job.symbol,
                };
                const ticket = this.toPositiveInt(job.orderId);
                if (ticket)
                    closePayload.ticket = ticket;
                return closePayload;
            }
            if (Number(job.volume) <= 0) {
                await this.dbService.markJobFailed(job, "Invalid volume");
                return {};
            }
            return {
                ackId: job.id,
                side: String(job.action).toLowerCase(),
                symbol: job.symbol,
                qty: Number(job.volume) || 1,
            };
        }
        catch (error) {
            throw error;
        }
    }
    async handleAck(ack) {
        const ackId = this.toPositiveInt(ack?.ackId);
        if (!ackId)
            return;
        const job = await this.dbService.getJobBySignalId(ackId);
        if (!job?.status?.id)
            return;
        const status = String(ack?.status ?? "").toLowerCase();
        const message = String(ack?.message ?? "unknown");
        const ticket = this.toPositiveInt(ack?.ticket ?? ack?.order_id ?? ack?.orderId);
        const signalStatus = String(job.status.status ?? "").toLowerCase();
        const isCloseJob = signalStatus === "pending_close" ||
            signalStatus === "in_progress_close" ||
            signalStatus === "closed";
        if (status === "success") {
            if (isCloseJob) {
                await this.dbService.markJobCloseSuccess(job, ticket ?? undefined);
                return;
            }
            await this.dbService.markJobSuccess(job, ticket ?? undefined);
            return;
        }
        if (status === "skipped" && isCloseJob) {
            await this.dbService.markJobCloseSuccess(job, ticket ?? undefined);
            return;
        }
        await this.dbService.markJobFailed(job, message);
    }
}
exports.Mt5ListenerServices = Mt5ListenerServices;
