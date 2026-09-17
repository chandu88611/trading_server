// src/app/trade/services/trade.db.ts
import AppDataSource from "../../../db/data-source";
import {
   AdminStrategyTrade,
   TradeSignal,
   TradeSignalStatus,
} from "../../../entity";
import { Brackets, QueryRunner } from "typeorm";
import { HttpStatusCode } from "../../../types/constants";

export type AdminStrategyTradeListQuery = {
  strategyId?: number;
  planId?: number;
  status?: string;
  from?: string;
  to?: string;
  start: number;
  count: number;
};

export class TradeDBService {
  private signalRepo = AppDataSource.getRepository(TradeSignal);
  private adminStrategyTradeRepo = AppDataSource.getRepository(AdminStrategyTrade);


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
            qb.where("tss.status IN (:...statuses)", { statuses: ["pending", "in_progress", "submitted", "partially_filled", "completed", "failed"] })
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

  async getHistoryForTrade({ userId, accountId, start, count, searchParams, status: _status }: { userId: number; accountId: string; start: number; count: number; searchParams?: string, status?: string }) {
    try {
      void _status;
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

  async listAdminStrategyTrades(query: AdminStrategyTradeListQuery) {
    try {
      const start = Number.isFinite(query.start) && query.start >= 0 ? query.start : 0;
      const count = Number.isFinite(query.count) && query.count > 0 ? query.count : 20;
      const qb = this.adminStrategyTradeRepo
        .createQueryBuilder("adminTrade")
        .leftJoinAndSelect("adminTrade.strategy", "strategy")
        .leftJoinAndSelect("adminTrade.plan", "plan")
        .orderBy("adminTrade.createdAt", "DESC")
        .skip(start)
        .take(count);

      if (query.strategyId) {
        qb.andWhere("adminTrade.strategyId = :strategyId", { strategyId: query.strategyId });
      }
      if (query.planId) {
        qb.andWhere("adminTrade.planId = :planId", { planId: query.planId });
      }
      if (query.status) {
        qb.andWhere("adminTrade.status = :status", { status: query.status });
      }
      if (query.from) {
        qb.andWhere("adminTrade.createdAt >= :from", { from: query.from });
      }
      if (query.to) {
        qb.andWhere("adminTrade.createdAt <= :to", { to: query.to });
      }

      const [data, total] = await qb.getManyAndCount();
      return {
        data,
        pagination: {
          start,
          count,
          total,
        },
      };
    } catch (error) {
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "database_error_fetching_admin_strategy_trades",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getAdminStrategyTrade(adminStrategyTradeId: number) {
    try {
      const adminStrategyTrade = await this.adminStrategyTradeRepo.findOne({
        where: { id: adminStrategyTradeId },
        relations: {
          strategy: true,
          plan: true,
        },
      });

      if (!adminStrategyTrade) {
        throw {
          statusCode: HttpStatusCode._NOT_FOUND,
          message: "admin_strategy_trade_not_found",
        };
      }

      const userTrades = await this.signalRepo
        .createQueryBuilder("ts")
        .leftJoin("ts.status", "tss")
        .leftJoin("ts.tradingAccount", "ta")
        .leftJoin("ts.user", "user")
        .leftJoin("ts.alertSnapshot", "snapshot")
        .where("ts.adminStrategyTradeId = :adminStrategyTradeId", { adminStrategyTradeId })
        .select([
          "ts.id AS id",
          "ts.userId AS \"userId\"",
          "user.email AS \"userEmail\"",
          "user.name AS \"userName\"",
          "ts.tradingAccountId AS \"tradingAccountId\"",
          "ta.accountId AS \"brokerAccountId\"",
          "ta.accountLabel AS \"accountLabel\"",
          "ts.action AS action",
          "ts.symbol AS symbol",
          "ts.exchange AS exchange",
          "ts.price AS price",
          "ts.volume AS volume",
          "ts.executionMode AS \"executionMode\"",
          "ts.entryRef AS \"entryRef\"",
          "ts.orderId AS \"orderId\"",
          "ts.brokerOrderId AS \"brokerOrderId\"",
          "ts.brokerPositionId AS \"brokerPositionId\"",
          "tss.status AS status",
          "tss.lastError AS \"lastError\"",
          "ts.alertSnapshotsId AS \"alertSnapshotId\"",
          "snapshot.alertTime AS \"alertTime\"",
          "ts.createdAt AS \"createdAt\"",
          "ts.updatedAt AS \"updatedAt\"",
        ])
        .orderBy("ts.createdAt", "DESC")
        .getRawMany();

      return {
        adminStrategyTrade,
        userTrades,
      };
    } catch (error) {
      throw error;
    }
  }

  async closeAdminStrategyTrade(
    adminStrategyTradeId: number,
    queryRunner: QueryRunner
  ) {
    try {
      const adminStrategyTrade = await queryRunner.manager
        .getRepository(AdminStrategyTrade)
        .findOne({ where: { id: adminStrategyTradeId } });

      if (!adminStrategyTrade) {
        throw {
          statusCode: HttpStatusCode._NOT_FOUND,
          message: "admin_strategy_trade_not_found",
        };
      }

      const totalLinkedTrades = await queryRunner.manager
        .getRepository(TradeSignal)
        .createQueryBuilder("ts")
        .where("ts.adminStrategyTradeId = :adminStrategyTradeId", { adminStrategyTradeId })
        .getCount();

      const signalsToClose = await queryRunner.manager
        .getRepository(TradeSignal)
        .createQueryBuilder("ts")
        .innerJoin("ts.status", "tss")
        .where("ts.adminStrategyTradeId = :adminStrategyTradeId", { adminStrategyTradeId })
        .andWhere("tss.status = :status", { status: "completed" })
        .select(["ts.id"])
        .getMany();

      const signalIds = signalsToClose.map((signal) => Number(signal.id));
      let queuedCloseCount = 0;

      if (signalIds.length > 0) {
        const updateSignalStatus = await queryRunner.manager
          .getRepository(TradeSignalStatus)
          .createQueryBuilder()
          .update(TradeSignalStatus)
          .set({ status: "pending_close", updatedAt: new Date() })
          .where("tradeSignalId IN (:...signalIds)", { signalIds })
          .andWhere("status = :status", { status: "completed" })
          .execute();
        queuedCloseCount = Number(updateSignalStatus.affected ?? 0);
      }

      await queryRunner.manager.getRepository(AdminStrategyTrade).update(
        { id: adminStrategyTradeId },
        {
          closeQueuedCount:
            Number(adminStrategyTrade.closeQueuedCount ?? 0) + queuedCloseCount,
          status: queuedCloseCount > 0 ? "close_requested" : adminStrategyTrade.status,
        }
      );

      return {
        adminStrategyTradeId,
        queuedCloseCount,
        skippedCount: Math.max(totalLinkedTrades - queuedCloseCount, 0),
        signalIds,
      };
  } catch (error) {
      throw error;
    }
  }
}
