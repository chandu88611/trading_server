import AppDataSource from "../../../../db/data-source";
import { Repository } from "typeorm";
import { ICreateTradeSignal } from "../interfaces/tradeSignal.interface";
import { TradeSignal } from "../../../../entity/TradeSignals";
import { BrokerJob } from "../../../../entity";

export class TradeSignalDB {
  private repo: Repository<TradeSignal>;
  private jobRepo: Repository<BrokerJob>;

  constructor() {
    this.repo = AppDataSource.getRepository(TradeSignal);
    this.jobRepo = AppDataSource.getRepository(BrokerJob);
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
    return this.repo.find({ where: { brokerJob: { id: jobId } }, order: { createdAt: "DESC" } });
  }
}
