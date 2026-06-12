import { DeepPartial, QueryRunner } from "typeorm";
import { ICreateTradeSignal } from "../interfaces/tradeSignal.interface";
import { TradeSignal } from "../../../../entity/TradeSignals";
import { AssetClassifier } from "../../../../types/trade-identify";
import { TradeSignalStatus } from "../../../../entity/TradeSignalsStatus";
import { TradeAlertDBService } from "../../../trade/services/tradeAlert.db";

export class TradeSignalDB {
  private tradeAlertDb = new TradeAlertDBService();

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
          adminStrategyTradeId: data.adminStrategyTradeId ?? null,
          strategyId: data.strategyId ?? null,
          planId: data.planId ?? null,
          subscriptionId: data.subscriptionId ?? null,
          action: data.action,
          symbol: data.symbol,
          price: data.price,
          exchange: data.exchange,
          signalTime: data.signalTime,
          volume: data.volume,
          assetType: AssetClassifier.detect({
            symbol: data.symbol,
            exchange: data.exchange,
          }),
          // Indian-market instrument classification (explicit)
          instrumentType: data.instrumentType ?? null,
          product: data.product ?? null,
          underlying: data.underlying ?? null,
          expiry: data.expiry ?? null,
          optionType: data.optionType ?? null,
          strike: data.strike ?? null,
          tradingSymbol: data.tradingSymbol ?? null,
          executionMode: data.executionMode ?? null,
          entryRef: data.entryRef ?? null,
          orderType: data.orderType ?? null,
          limitPrice: data.limitPrice ?? null,
          stopPrice: data.stopPrice ?? null,
          stopLoss: data.stopLoss ?? null,
          takeProfit: data.takeProfit ?? null,
          stopLossDistance: data.stopLossDistance ?? null,
          takeProfitDistance: data.takeProfitDistance ?? null,
          stopLossAmount: data.stopLossAmount ?? null,
          takeProfitAmount: data.takeProfitAmount ?? null,
          trailingStopLoss: data.trailingStopLoss ?? null,
          guaranteedStopLoss: data.guaranteedStopLoss ?? null,
          stopLossTriggerMethod: data.stopLossTriggerMethod ?? null,
          trailingTakeProfitActivationDistance:
            data.trailingTakeProfitActivationDistance ?? null,
          trailingTakeProfitDistance: data.trailingTakeProfitDistance ?? null,
          breakEvenActivationDistance:
            data.breakEvenActivationDistance ?? null,
          breakEvenOffsetDistance: data.breakEvenOffsetDistance ?? null,
          trailingStopLossDistance: data.trailingStopLossDistance ?? null,
          brokerOrderId:
            data.brokerOrderId === undefined || data.brokerOrderId === null
              ? null
              : String(data.brokerOrderId),
          brokerPositionId:
            data.brokerPositionId === undefined || data.brokerPositionId === null
              ? null
              : String(data.brokerPositionId),
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
      await this.tradeAlertDb.createForTradeSignals(savedSignals, queryRunner);
      return entity;
    } catch (error) {
      throw error;
    }
  }
}
