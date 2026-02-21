import { DeepPartial, QueryRunner } from "typeorm";
import { ICreateTradeSignal } from "../interfaces/tradeSignal.interface";
import { TradeSignal } from "../../../../entity/TradeSignals";
import { AssetClassifier } from "../../../../types/trade-identify";
import { TradeSignalStatus } from "../../../../entity/TradeSignalsStatus";

export class TradeSignalDB {
  async createTradeSignal(
    alertData: ICreateTradeSignal[],
    queryRunner: QueryRunner
  ) {
    try {
      const createdSignals: DeepPartial<TradeSignal>[] = alertData.map((data) => {
        return {
          userId: data.userId,
          tradingAccountId: data.tradingAccountId,
          alertSnapshotsId: data.alertSnapshotsId,
          action: data.action,
          symbol: data.symbol,
          price: data.price,
          exchange: data.exchange,
          signalTime: new Date(),
          volume: data.volume,
          assetType: AssetClassifier.detect({
            symbol: data.symbol,
            exchange: data.exchange,
          }),
        };
      });
      const entity = queryRunner.manager
        .getRepository(TradeSignal)
        .create(createdSignals);
      const savedSignals = await queryRunner.manager
        .getRepository(TradeSignal)
        .save(entity);

      let StatusEntity = savedSignals.map((signal) => {
        return {
          tradeSignalId: signal.id,
          status: "pending",
        }
      })
        const statusEntityData = queryRunner.manager.getRepository(TradeSignalStatus).create(StatusEntity);
        await queryRunner.manager.getRepository(TradeSignalStatus).save(statusEntityData);
      return entity;
    } catch (error) {
      throw error;
    }
  }
}
