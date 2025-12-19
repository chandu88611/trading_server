import AppDataSource from "../../../../db/data-source";
import { QueryRunner, Repository } from "typeorm";
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

  async create(payload: ICreateAlertSnapshot, brokerJobId: number, queryRunner:QueryRunner) {
    try {
      const entity: AlertSnapshot = queryRunner.manager.getRepository(AlertSnapshot).create({
        brokerJob: { id: brokerJobId } as BrokerJob,
        ticker: payload.ticker,
        exchange: payload.exchange,
        interval: payload.interval,
        barTime: payload.barTime,
        alertTime: payload.alertTime,
        open: payload.open,
        close: payload.close,
        high: payload.high,
        low: payload.low,
        volume: payload.volume,
        currency: payload.currency ?? null,
        baseCurrency: payload.baseCurrency ?? null,
      });
      return await queryRunner.manager.getRepository(AlertSnapshot).save(entity);
    } catch (error) {
      throw error;
    }
  }

  async listByJob(jobId: number) {
    return this.repo.find({
      where: { brokerJob: { id: jobId } },
      order: { createdAt: "DESC" },
    });
  }
}
