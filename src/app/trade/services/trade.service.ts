// src/app/trade/services/trade.service.ts
import AppDataSource from "../../../db/data-source";
import { TradeGuardService } from "./tradeGuard.service";
import { TradeDBService } from "./trade.db";
import { CtraderGatewayClient } from "../../../infra/ctraderGateway.client";
import { CopyTradeSideEnum } from "../../../db/enums";
import { AssetClassifier } from "../../../types/trade-identify";
import { HttpStatusCode } from "../../../types/constants";

export type CreateTradePayload = {
  tradingAccountId: number;
  symbol: string;
  side: CopyTradeSideEnum;
  quantity: number;
  price?: number | null;
  exchange?: string | null;
};

export class TradeService {
  private db = new TradeDBService();

  async getAllTradesForUser({userId, accountId, start, count, searchParams, status}: {userId: number, accountId: string, start: number, count: number, searchParams?: string, status?: string}) {
    return this.db.getAllTradeForUser({ userId, accountId, start, count, searchParams, status });
  } 

  async getSignalStatusForTrade(signalId: number) {
    return this.db.getSignalStatusForTrade(signalId);
  }

  async getTradeHistory({userId, accountId, start, count, searchParams, status}: {userId: number, accountId: string, start: number, count: number, searchParams?: string, status?: string}) {
    return this.db.getHistoryForTrade({ userId, accountId, start, count, searchParams, status });
  }

  async closeTrade(signalIds: number[], userId: number, isCloseAll: boolean) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const result = await this.db.closeTrade(signalIds, userId, isCloseAll, queryRunner);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
       throw error
    } finally {
      await queryRunner.release();
    }
  }
}
