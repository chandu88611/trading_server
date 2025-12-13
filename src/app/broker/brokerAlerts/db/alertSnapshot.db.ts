import AppDataSource from "../../../../db/data-source";
import { Repository } from "typeorm";
import { ICreateAlertSnapshot } from "../interfaces/alertSnapshot.interface";
import { AlertSnapshot } from "../../../../entity/AlertSnapshots";
import { BrokerJob } from "../../../../entity";

export class AlertSnapshotDB {
  private repo: Repository<AlertSnapshot>;
  private jobRepo: Repository<BrokerJob>;

  constructor() {
    this.repo = AppDataSource.getRepository(AlertSnapshot);
    this.jobRepo = AppDataSource.getRepository(BrokerJob);
  }

  async create(payload: ICreateAlertSnapshot) {
    const job = await this.jobRepo.findOne({ where: { id: payload.jobId } });
    if (!job) throw new Error("job_not_found");
    const entity = this.repo.create({
      brokerJob: { id: payload.jobId } as BrokerJob,
      ticker: payload.ticker,
      exchange: payload.exchange ?? null,
      interval: payload.interval ?? null,
      barTime: payload.barTime ?? null,
      alertTime: payload.alertTime ?? null,
      open: payload.open ?? null,
      close: payload.close ?? null,
      high: payload.high ?? null,
      low: payload.low ?? null,
      volume: payload.volume ?? null,
      currency: payload.currency ?? null,
      baseCurrency: payload.baseCurrency ?? null,
    });
    return this.repo.save(entity);
  }

  async listByJob(jobId: number) {
    return this.repo.find({ where: { brokerJob: { id: jobId } }, order: { createdAt: "DESC" } });
  }
}
