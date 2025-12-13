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

import { BrokerExecutionService } from "../services/brokerExecution.service";
import { BrokerEventService } from "../../brokerEvents/services/brokerEvent.service";
import { TradeSignalService } from "../../brokerSignals/services/tradeSignal.service";
import { AlertSnapshotService } from "../../brokerAlerts/services/alertSnapshot.service";
import { BrokerJobService } from "../../brokerJobs/services/brokerJob.service";
import { IExecutionConfig } from "../interfaces/execution.interface";

const DEFAULT_CONFIG: IExecutionConfig = {
  pollIntervalMs: Number(process.env.JOB_POLL_INTERVAL_MS) || 1000,
  concurrency: Number(process.env.JOB_WORKER_CONCURRENCY) || 2,
  maxAttempts: Number(process.env.JOB_MAX_ATTEMPTS) || 5,
};

export class JobProcessor {
  private execSvc = new BrokerExecutionService();
  private eventSvc = new BrokerEventService();
  private signalSvc = new TradeSignalService();
  private alertSvc = new AlertSnapshotService();
  private jobSvc = new BrokerJobService(); // used for reading job payload/detailed relations
  private config: IExecutionConfig;
  private running = false;
  private active = 0;

  constructor(config?: Partial<IExecutionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...(config ?? {}) };
  }

  async start() {
    if (this.running) return;
    this.running = true;
    for (let i = 0; i < this.config.concurrency; i++) this.loop();
    console.info("JobProcessor started, concurrency:", this.config.concurrency);
  }

  async stop() {
    this.running = false;
  }

  private async loop() {
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

  private async handleJob(job: any) {
    const jobId = job.id;
    try {
      const full = await this.jobSvc.getById(jobId);
      if (!full) return;
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
    } catch (err: any) {
      console.error("job process error", err?.message ?? err);
      const attempts = (job.attempts ?? 0) + 1;
      await this.execSvc.markFailed(
        job.id,
        String(err?.message ?? "unknown"),
        attempts,
        this.config.maxAttempts
      );
      await this.eventSvc.create({
        jobId: job.id,
        eventType: "job.failed",
        payload: { error: err?.message },
      });
    }
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }
}
