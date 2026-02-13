import { Mt5ListenerDBServices } from "./mt5Listener.db";

export class Mt5ListenerServices {
  constructor(
    private readonly dbService: Mt5ListenerDBServices
  ) {}

  async getSignalForEA(brokerAccountId: string) {
    try {
         const job = await this.dbService.getNextPendingJob(
      brokerAccountId
    );
    if (!job) return {};
    
    await this.dbService.markJobInProgress(job);
    
    if(job.volume <= 0){
      await this.dbService.markJobFailed(
        job,
        "Invalid volume"
      );
      return {};
    }

    return {
      ackId: job.id,                   
      side: String(job.action).toLowerCase(),
      symbol: job.symbol,
      qty: Number(job.volume) || 1,
    }; 
    } catch (error) {
      throw error;
    }
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
