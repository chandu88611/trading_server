import AppDataSource from "../../../../db/data-source";
import { QueryRunner, Repository } from "typeorm";
import { HistoryQuery, ICreateAlertSnapshot } from "../interfaces/alertSnapshot.interface";
import { AlertSnapshot } from "../../../../entity/AlertSnapshots";
import { UserTradeType } from "../../../../db/enums";
import { TradeSignalService } from "../../brokerSignals/services/tradeSignal.service";
import { ICreateTradeSignal } from "../../brokerSignals/interfaces/tradeSignal.interface";
import { Broker } from "../../../../entity/Brokers";
import { AssetType, MarketType } from "../../../../types/trade-identify";
import { HttpStatusCode } from "../../../../types/constants";
// import { CTraderService } from "../../../cTraderListener/services/cTrader";

const OPEN_STATUSES = ["pending", "running", "queued"];

export class AlertSnapshotDB {
  private repo: Repository<AlertSnapshot>;
  private broker: Repository<Broker>
  private tradeSignalService: TradeSignalService;

  constructor() {
    this.repo = AppDataSource.getRepository(AlertSnapshot);
    this.tradeSignalService = new TradeSignalService();
    this.broker = AppDataSource.getRepository(Broker);
  }

  async create(
    payload: ICreateAlertSnapshot,
    queryRunner: QueryRunner
  ) {
    try {
      const entity: AlertSnapshot = queryRunner.manager
        .getRepository(AlertSnapshot)
        .create({
          userId: payload.userId,
          ticker: payload.ticker,
          exchange: payload.exchange,
          interval: payload.interval,
          barTime: payload.barTime,
          alertTime: payload.alertTime,
          open: payload.open,
          close: payload.close,
          high: payload.high,
          low: payload.low,
          volume: payload.volume,
          currency: payload.currency ?? null,
          baseCurrency: payload.baseCurrency ?? null,
        });
      return await queryRunner.manager
        .getRepository(AlertSnapshot)
        .save(entity);
    } catch (error) {
      throw error;
    }
  }

  async getAlertHistory(userId: number, query: HistoryQuery) {
    const qb = this.repo.createQueryBuilder("snapshot").where("snapshot.userId = :userId", { userId });

    if (query.ticker) {
      qb.andWhere("snapshot.ticker = :ticker", { ticker: query.ticker });
    }
    if (query.exchange) {
      qb.andWhere("snapshot.exchange = :exchange", { exchange: query.exchange });
    }
    if (query.interval) {
      qb.andWhere("snapshot.interval = :interval", { interval: query.interval });
    }
    if (query.from) {
      qb.andWhere("snapshot.alertTime >= :from", { from: query.from });
    }
    if (query.to) {
      qb.andWhere("snapshot.alertTime <= :to", { to: query.to });
    }

    qb.orderBy("snapshot.alertTime", "DESC").skip((query.page - 1) * query.limit).take(query.limit);

    return await qb.getMany();
  }

  async getBrokerId(marketType: MarketType) {
    try {
        const brokerData = await this.broker.find({
          where: {
            marketCategory: marketType,
            isActive: true,
          },    
        });
        if (!brokerData || brokerData.length === 0) {
          throw {
            status: HttpStatusCode._NOT_FOUND,
            message: "no_broker_found_for_market_type",
          };
        }
        return brokerData.map(broker => broker.id);
    } catch (error) {
      throw error;
    }
  }

  getMarketType(assetType: AssetType) {
    switch (assetType) {
      case AssetType.FOREX:
        return MarketType.FOREX;
      case AssetType.CRYPTO:
        return MarketType.CRYPTO;
      default:
        return MarketType.INDIAN;
    }
  }
}

