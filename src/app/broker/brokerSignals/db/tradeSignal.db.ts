import AppDataSource from "../../../../db/data-source";
import { QueryRunner, Repository } from "typeorm";
import { ICreateTradeSignal } from "../interfaces/tradeSignal.interface";
import { TradeSignal } from "../../../../entity/TradeSignals";
import { BrokerJob } from "../../../../entity";
import { Query } from "typeorm/driver/Query";
import { AssetClassifier } from "../../../../types/trade-identify";

export class TradeSignalDB {
  private repo: Repository<TradeSignal>;
  private jobRepo: Repository<BrokerJob>;

  constructor() {
    this.repo = AppDataSource.getRepository(TradeSignal);
    this.jobRepo = AppDataSource.getRepository(BrokerJob);
  }

  async createTradeSignal(
    alertData: ICreateTradeSignal,
    queryRunner: QueryRunner
  ) {
    try {
      const entity = queryRunner.manager.getRepository(TradeSignal).create({
        jobId: alertData.jobId,
        action: alertData.action,
        symbol: alertData.symbol,
        price: alertData.price,
        exchange: alertData.exchange,
        signalTime: alertData.signalTime,
        assetType: AssetClassifier.detect({
          symbol: alertData.symbol,
          exchange: alertData.exchange,
        }),
      });
      await queryRunner.manager.getRepository(TradeSignal).save(entity);
      return entity;
    } catch (error) {
      throw error;
    }
  }

  async create(payload: ICreateTradeSignal) {
    const job = await this.jobRepo.findOne({ where: { id: payload.jobId } });
    if (!job) throw new Error("job_not_found");
    const entity = this.repo.create({
      brokerJob: { id: payload.jobId } as BrokerJob,
      action: payload.action,
      symbol: payload.symbol,
      price: payload.price,
      exchange: payload.exchange,
      signalTime: payload.signalTime,
    });
    return this.repo.save(entity);
  }

  async listByJob(jobId: number) {
    return this.repo.find({
      where: { brokerJob: { id: jobId } },
      order: { createdAt: "DESC" },
    });
  }
}
