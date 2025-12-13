import { TradeSignalDB } from "../db/tradeSignal.db";
import { ICreateTradeSignal } from "../interfaces/tradeSignal.interface";

export class TradeSignalService {
  private db = new TradeSignalDB();

  async create(payload: ICreateTradeSignal) {
    return this.db.create(payload);
  }

  async listByJob(jobId: number) {
    return this.db.listByJob(jobId);
  }
}
