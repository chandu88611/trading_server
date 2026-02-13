import { QueryRunner } from "typeorm";
import { TradeSignalDB } from "../db/tradeSignal.db";
import { ICreateTradeSignal } from "../interfaces/tradeSignal.interface";

export class TradeSignalService {
  private db = new TradeSignalDB();

  async createTradeSignal(alertData: ICreateTradeSignal[], queryRunner:QueryRunner) {
    try {
      return await this.db.createTradeSignal(alertData, queryRunner);
    } catch (error) {
      throw error;
    }
  }

}
