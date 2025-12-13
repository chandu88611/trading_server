import { BrokerEventDB } from "../db/brokerEvent.db";
import { ICreateBrokerEvent } from "../interfaces/brokerEvent.interface";

export class BrokerEventService {
  private db = new BrokerEventDB();

  async create(payload: ICreateBrokerEvent) {
    return this.db.create(payload);
  }

  async listByJob(jobId: number) {
    return this.db.listByJob(jobId);
  }
}
