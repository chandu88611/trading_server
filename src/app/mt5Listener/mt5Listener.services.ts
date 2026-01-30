import { Mt5ListenerDBServices } from "./mt5Listener.db";

export class Mt5ListenerServices {
  constructor(
    private readonly dbService: Mt5ListenerDBServices
  ) {}

  async getSignalForEA(brokerAccountId: string) {
    const job = await this.dbService.getNextPendingJob(
      brokerAccountId
    );
    if (!job) return {}; // EA ignores
    
    await this.dbService.markJobInProgress(job.job_id);

    return {
      ackId: job.job_id,                   // monotonic
      side: String(job.side).toLowerCase(),// buy/sell
      symbol: job.symbol,
      qty: Number(job.qty) || 0,
    };
  }

  async handleAck(ack: any) {
    const { ackId, status, message } = ack;
    if (!ackId) return;

    if (status === "success") {
      await this.dbService.markJobSuccess(ackId);
    } else {
      await this.dbService.markJobFailed(
        ackId,
        message || "unknown"
      );
    }
  }
}
