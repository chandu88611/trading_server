// src/app/trade/services/trade.db.ts
import AppDataSource from "../../../db/data-source";
import {
   AlertSnapshot,
   TradeSignal,
   TradeSignalStatus,
} from "../../../entity";
import { CopyTradeSideEnum } from "../../../db/enums";
import { AssetType } from "../../../types/trade-identify";
import { Brackets, QueryRunner } from "typeorm";
import { HttpStatusCode } from "../../../types/constants";

export class TradeDBService {
  private snapshotRepo = AppDataSource.getRepository(AlertSnapshot);
  private signalRepo = AppDataSource.getRepository(TradeSignal);


  async getAllTradeForUser({ userId, accountId, start, count, searchParams, status }: { userId: number; accountId: string; start: number; count: number; searchParams?: string, status?: string }) {
    try {      
      let data = await this.signalRepo.createQueryBuilder("ts")
        .leftJoinAndSelect("ts.tradingAccount", "ta")
        .leftJoinAndSelect("ts.status", "tss")
        .where("ta.userId = :userId", { userId })
        .andWhere("ta.id = :accountId", { accountId })
        .andWhere(new Brackets(qb => {
          if (status) {
            qb.where("tss.status = :status", { status })
          } else {
            qb.where("tss.status IN (:...statuses)", { statuses: ["pending", "in_progress", "completed", "failed"] })
          }
        }))
        .orderBy("ts.createdAt", "DESC")
        .skip(start)
        .take(count);

      if (searchParams) {
        data = data.andWhere("ts.symbol ILIKE :searchParams", { searchParams: `%${searchParams}%` })
      }

      return await data.getMany();

    } catch (error) {
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "database_error_fetching_trades",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getSignalStatusForTrade(signalId: number) {
    try {
      const status: TradeSignal | null = await this.signalRepo.createQueryBuilder("ts")
      .leftJoinAndSelect("ts.status", "tss")
      .leftJoinAndSelect("ts.tradingAccount", "ta")
        .where("ts.id = :signalId", { signalId })
        .getOne();
      if (!status) {
        throw {
          statusCode: HttpStatusCode._NOT_FOUND,
          message: "signal_status_not_found",
        };
      }
      return status;
    } catch (error) {
      throw error;
    }
  }

  async getHistoryForTrade({ userId, accountId, start, count, searchParams, status }: { userId: number; accountId: string; start: number; count: number; searchParams?: string, status?: string }) {
    try {
      let data = await this.signalRepo.createQueryBuilder("ts")
        .leftJoinAndSelect("ts.tradingAccount", "ta")
        .leftJoinAndSelect("ts.status", "tss")
        .where("ta.userId = :userId", { userId })
        .andWhere("ta.id = :accountId", { accountId })
        .andWhere(new Brackets(qb => {
            qb.where("tss.status IN (:...statuses)", { statuses: ["closed","pending_close"] })
        }))
        .orderBy("ts.createdAt", "DESC")
        .skip(start)
        .take(count);

      if (searchParams) {
        data = data.andWhere("ts.symbol ILIKE :searchParams", { searchParams: `%${searchParams}%` })
      }

      return await data.getMany();

    } catch (error) {
      throw error;
    }
  }

  async closeTrade(signalIds: number[], userId: number, isCloseAll: boolean, queryRunner: QueryRunner) {
  try {
    if(signalIds.length === 0 && !isCloseAll){
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: "missing_signal_ids",
      };
    }
    console.log("Closing trades with signalIds:", signalIds, "for userId:", userId, "isCloseAll:", isCloseAll);
    const signalQb = queryRunner.manager.getRepository(TradeSignal).createQueryBuilder("ts")
      .leftJoin("ts.tradingAccount", "ta")
      .leftJoin("ts.status", "tss")
      .where("ta.userId = :userId", { userId })
      .andWhere("tss.status = :status", { status: "completed" })
      if (!isCloseAll) {
        signalQb.andWhere("ts.id IN (:...signalIds)", { signalIds })
      }
    const signalsToClose = await signalQb.getMany();

    if (signalsToClose.length === 0) {
      throw {
        statusCode: HttpStatusCode._NOT_FOUND,
        message: "no_trades_found_to_close",
      };
    }
    let updateSignalStatus = await queryRunner.manager.getRepository(TradeSignalStatus).createQueryBuilder()
      .update(TradeSignalStatus)
      .set({ status: "pending_close" })
      .where("tradeSignalId IN (:...ids)", { ids: signalsToClose.map(s => s.id) })
      .execute();

    return {
      message: `${updateSignalStatus.affected} trade(s) closed successfully`,
    };
  } catch (error) {
    throw error
  }
  }
}