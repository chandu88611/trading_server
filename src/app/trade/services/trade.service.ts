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
  private guard = new TradeGuardService();
  private db = new TradeDBService();
  private gateway = new CtraderGatewayClient();

  async createTrade(userId: number, payload: CreateTradePayload) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { symbol, exchange } = payload;

      // 1) check plan & user status
      const check = await this.guard.checkTradeAllowed({
        userId,
        symbol,
        exchange,
      });

      if (!check.allowed) {
        return {
          ok: false,
          blocked: true,
          reason: check.reason,
        };
      }

      // 2) call gateway to actually place the order
      let gwResp;
      try {
        gwResp = await this.gateway.placeOrder({
          tradingAccountId: payload.tradingAccountId,
          symbol: payload.symbol,
          side: payload.side,
          quantity: payload.quantity,
          price: payload.price ?? null,
        });
      } catch (error) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "gateway_order_placement_failed",
          error: error instanceof Error ? error.message : String(error),
        };
      }

      // 3) log trade signal
      const assetType = AssetClassifier.detect({ symbol, exchange });
      const signal = await this.db.logSignalWithRunner(
        {
          userId,
          side: payload.side,
          symbol,
          price: payload.price ?? null,
          exchange: payload.exchange ?? null,
          assetType,
        },
        queryRunner
      );

      await queryRunner.commitTransaction();

      return {
        ok: true,
        gateway: gwResp,
        signal,
        subscriptionId: check.subscriptionId ?? null,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof Object && 'statusCode' in error) {
        throw error;
      }
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "failed_to_create_trade",
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      await queryRunner.release();
    }
  }
}
