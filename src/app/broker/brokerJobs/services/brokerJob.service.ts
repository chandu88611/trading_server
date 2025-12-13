import { BrokerJobDB } from "../db/brokerJob.db";
import {
  ICreateBrokerJob,
  IUpdateBrokerJob,
} from "../interfaces/brokerJob.interface";

export class BrokerJobService {
  private db = new BrokerJobDB();

  async create(payload: ICreateBrokerJob) {
    return this.db.create(payload);
  }

  async update(id: number, payload: IUpdateBrokerJob) {
    return this.db.update(id, payload);
  }

  async getById(id: number) {
    return this.db.getById(id);
  }

  async listByCredential(credentialId: number) {
    return this.db.listByCredential(credentialId);
  }

  async listPending(limit = 50) {
    return this.db.listPending(limit);
  }

  async markInProgress(id: number, attempts: number) {
    return this.db.update(id, { status: "in_progress", attempts });
  }

  async markCompleted(id: number) {
    return this.db.update(id, { status: "completed" });
  }

  async markFailed(id: number, error: string, attempts: number, maxAttempts: number) {
    const status = attempts >= maxAttempts ? "failed" : "pending";
    return this.db.update(id, {
      status,
      lastError: error,
      attempts
    });
  }
}
