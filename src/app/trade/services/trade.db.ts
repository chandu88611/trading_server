// src/app/trade/services/trade.db.ts
import AppDataSource from "../../../db/data-source";
import {
  AlertSnapshotEntity as AlertSnapshot,
  TradeSignalEntity as TradeSignal,
} from "../../../entities";
import { CopyTradeSideEnum } from "../../../db/enums";
import { AssetType } from "../../../types/trade-identify";
import { QueryRunner } from "typeorm";
import { HttpStatusCode } from "../../../types/constants";

export class TradeDBService {
  private snapshotRepo = AppDataSource.getRepository(AlertSnapshot);
  private signalRepo = AppDataSource.getRepository(TradeSignal);

  async logSignal(params: {
    userId: number;
    side: CopyTradeSideEnum;
    symbol: string;
    price?: number | null;
    exchange?: string | null;
    assetType: AssetType;
  }) {
    try {
      const now = new Date();

      // minimal snapshot, many fields nullable in schema
      const snapshot = this.snapshotRepo.create({
        userId: params.userId,
        ticker: params.symbol,
        exchange: params.exchange ?? null,
        interval: "TRADE",
        barTime: now,
        alertTime: now,
        open: null,
        close: params.price != null ? String(params.price) : null,
        high: null,
        low: null,
        volume: null,
        currency: null,
        baseCurrency: null,
      });

      const savedSnap = await this.snapshotRepo.save(snapshot);
      const savedSnapId = (Array.isArray(savedSnap) ? savedSnap[0] : savedSnap).id;

      const signal = this.signalRepo.create({
        alertSnapshotId: savedSnapId,
        action: params.side,
        symbol: params.symbol,
        price: params.price != null ? String(params.price) : null,
        exchange: params.exchange ?? null,
        assetType: String(params.assetType),
        signalTime: now,
      });

      return await this.signalRepo.save(signal);
    } catch (error) {
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "database_error_logging_signal",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async logSignalWithRunner(
    params: {
      userId: number;
      side: CopyTradeSideEnum;
      symbol: string;
      price?: number | null;
      exchange?: string | null;
      assetType: AssetType;
    },
    queryRunner: QueryRunner
  ) {
    try {
      const now = new Date();

      // minimal snapshot, many fields nullable in schema
      const snapshot = queryRunner.manager.create(AlertSnapshot, {
        userId: params.userId,
        ticker: params.symbol,
        exchange: params.exchange ?? null,
        interval: "TRADE",
        barTime: now,
        alertTime: now,
        open: null,
        close: params.price != null ? String(params.price) : null,
        high: null,
        low: null,
        volume: null,
        currency: null,
        baseCurrency: null,
      });

      const savedSnap = await queryRunner.manager.save(snapshot);
      const savedSnapId = (Array.isArray(savedSnap) ? savedSnap[0] : savedSnap).id;

      const signal = queryRunner.manager.create(TradeSignal, {
        alertSnapshotId: savedSnapId,
        action: params.side,
        symbol: params.symbol,
        price: params.price != null ? String(params.price) : null,
        exchange: params.exchange ?? null,
        assetType: String(params.assetType),
        signalTime: now,
      });

      return await queryRunner.manager.save(signal);
    } catch (error) {
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "database_error_logging_signal",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
