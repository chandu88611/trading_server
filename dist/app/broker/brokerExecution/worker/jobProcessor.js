"use strict";
/**
 * Simple job processor worker.
 * Run separately (node dist/... or ts-node).
 *
 * Behavior:
 * - Poll broker_jobs for pending jobs
 * - Claim and set to in_progress
 * - Run executor (pluggable per job.type)
 * - On success: mark completed and write events/signals/snapshots
 * - On failure: increment attempts and mark pending/failed based on max attempts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobProcessor = void 0;
const brokerExecution_service_1 = require("../services/brokerExecution.service");
const brokerEvent_service_1 = require("../../brokerEvents/services/brokerEvent.service");
const tradeSignal_service_1 = require("../../brokerSignals/services/tradeSignal.service");
const alertSnapshot_service_1 = require("../../brokerAlerts/services/alertSnapshot.service");
const brokerJob_service_1 = require("../../brokerJobs/services/brokerJob.service");
const DEFAULT_CONFIG = {
    pollIntervalMs: Number(process.env.JOB_POLL_INTERVAL_MS) || 1000,
    concurrency: Number(process.env.JOB_WORKER_CONCURRENCY) || 2,
    maxAttempts: Number(process.env.JOB_MAX_ATTEMPTS) || 5,
};
class JobProcessor {
    constructor(config) {
        this.execSvc = new brokerExecution_service_1.BrokerExecutionService();
        this.eventSvc = new brokerEvent_service_1.BrokerEventService();
        this.signalSvc = new tradeSignal_service_1.TradeSignalService();
        this.alertSvc = new alertSnapshot_service_1.AlertSnapshotService();
        this.jobSvc = new brokerJob_service_1.BrokerJobService(); // used for reading job payload/detailed relations
        this.running = false;
        this.active = 0;
        this.config = { ...DEFAULT_CONFIG, ...(config ?? {}) };
    }
    async start() {
        if (this.running)
            return;
        this.running = true;
        for (let i = 0; i < this.config.concurrency; i++)
            this.loop();
        console.info("JobProcessor started, concurrency:", this.config.concurrency);
    }
    async stop() {
        this.running = false;
    }
    async loop() {
        while (this.running) {
            if (this.active >= this.config.concurrency) {
                await this.sleep(this.config.pollIntervalMs);
                continue;
            }
            const job = await this.execSvc.claimPendingJob();
            if (!job) {
                await this.sleep(this.config.pollIntervalMs);
                continue;
            }
            this.active++;
            this.handleJob(job).finally(() => {
                this.active--;
            });
        }
    }
    async handleJob(job) {
        const jobId = job.id;
        try {
            const full = await this.jobSvc.getById(jobId);
            if (!full)
                return;
            switch (full.type) {
                case "fetch_market": {
                    const signal = {
                        jobId,
                        action: "buy",
                        symbol: "ABC",
                        price: 123.45,
                        exchange: "NSE",
                        signalTime: new Date(),
                    };
                    await this.signalSvc.create(signal);
                    const snapshot = {
                        jobId,
                        ticker: "ABC",
                        exchange: "NSE",
                        interval: "1m",
                        barTime: new Date(),
                        alertTime: new Date(),
                        open: 120,
                        close: 123.45,
                        high: 125,
                        low: 119,
                        volume: 10000,
                        currency: "INR",
                        baseCurrency: "INR",
                    };
                    await this.alertSvc.create(snapshot);
                    await this.eventSvc.create({
                        jobId,
                        eventType: "fetch_market.completed",
                        payload: { ok: true },
                    });
                    break;
                }
                case "place_order": {
                    await this.eventSvc.create({
                        jobId,
                        eventType: "place_order.started",
                        payload: {},
                    });
                    await this.eventSvc.create({
                        jobId,
                        eventType: "place_order.completed",
                        payload: { success: true },
                    });
                    break;
                }
                default: {
                    await this.eventSvc.create({
                        jobId,
                        eventType: "unknown_job_type",
                        payload: { type: full.type },
                    });
                }
            }
            await this.execSvc.markCompleted(jobId);
        }
        catch (err) {
            console.error("job process error", err?.message ?? err);
            const attempts = (job.attempts ?? 0) + 1;
            await this.execSvc.markFailed(job.id, String(err?.message ?? "unknown"), attempts, this.config.maxAttempts);
            await this.eventSvc.create({
                jobId: job.id,
                eventType: "job.failed",
                payload: { error: err?.message },
            });
        }
    }
    sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }
}
exports.JobProcessor = JobProcessor;
