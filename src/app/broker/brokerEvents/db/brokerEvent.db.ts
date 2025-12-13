import AppDataSource from "../../../../db/data-source";
import { Repository } from "typeorm";
import { BrokerEvent, BrokerJob } from "../../../../entity";
import { ICreateBrokerEvent } from "../interfaces/brokerEvent.interface";

export class BrokerEventDB {
  private repo: Repository<BrokerEvent>;
  private jobRepo: Repository<BrokerJob>;

  constructor() {
    this.repo = AppDataSource.getRepository(BrokerEvent);
    this.jobRepo = AppDataSource.getRepository(BrokerJob);
  }

  async create(payload: ICreateBrokerEvent) {
    const job = await this.jobRepo.findOne({ where: { id: payload.jobId } });
    if (!job) throw new Error("job_not_found");
    const e = this.repo.create({
      job: { id: payload.jobId } as BrokerJob,
      eventType: payload.eventType,
      payload: payload.payload ?? null,
    });
    return this.repo.save(e);
  }

  async listByJob(jobId: number) {
    return this.repo.find({ where: { job: { id: jobId } }, order: { createdAt: "ASC" } });
  }
}
