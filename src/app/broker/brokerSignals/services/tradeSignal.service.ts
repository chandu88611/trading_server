import { QueryRunner } from "typeorm";
import { TradeSignalDB } from "../db/tradeSignal.db";
import { ICreateTradeSignal } from "../interfaces/tradeSignal.interface";

export class TradeSignalService {
  private db = new TradeSignalDB();

  async create(payload: ICreateTradeSignal) {
    return this.db.create(payload);
  }
  async createTradeSignal(alertData: ICreateTradeSignal, queryRunner:QueryRunner) {
    try {
      await this.db.createTradeSignal(alertData, queryRunner);
    } catch (error) {
      throw error;
    }
  }

  async listByJob(jobId: number) {
    return this.db.listByJob(jobId);
  }
}
