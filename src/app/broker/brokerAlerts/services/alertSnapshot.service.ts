import AppDataSource from "../../../../db/data-source";
import { HttpStatusCode } from "../../../../types/constants";
import { AssetClassifier, AssetType } from "../../../../types/trade-identify";
// import { CopyTradingService } from "../../../copyTrading/services/copyTrading.service";
// import { CTraderService } from "../../../cTraderListener/services/cTrader";
import { UserSubscriptionService } from "../../../userSubscription/services/userSubscription";
import { TradeSignalService } from "../../brokerSignals/services/tradeSignal.service";
import { AlertSnapshotDB } from "./alertSnapshot.db";
import {
  HistoryQuery,
  ICreateAlertSnapshot,
} from "../interfaces/alertSnapshot.interface";
import { AlertSnapshot } from "../../../../entity/AlertSnapshots";
import { TradingAccountService } from "../../../tradingAccount/services/tradingAccount.service";
import { ICreateTradeSignal } from "../../brokerSignals/interfaces/tradeSignal.interface";

export class AlertSnapshotService {
  private alertSnapshotDB: AlertSnapshotDB;
  private tradeSignalService: TradeSignalService;
  // private cTraderService: CTraderService;
  private userSubscriptionService: UserSubscriptionService;
  // private copyTradingService: CopyTradingService;
  private tradingAccountService: TradingAccountService
  constructor() {
    this.alertSnapshotDB = new AlertSnapshotDB();
    this.tradeSignalService = new TradeSignalService();
    this.userSubscriptionService = new UserSubscriptionService();
    // this.copyTradingService = new CopyTradingService();
    // this.cTraderService = new CTraderService();
    this.tradingAccountService = new TradingAccountService();
  }
  async create(payload: ICreateAlertSnapshot) {
    const queryRunner = AppDataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {

      let assetType = await this.isValidAssetType(payload);

      let isValidPlan =
        await this.userSubscriptionService.subscriberPlanValidation(
          payload.userId,
          payload.market,
        ); 
      if (!isValidPlan) {
        throw {
          status: HttpStatusCode._BAD_REQUEST,
          message: "invalid_subscription_plan",
        };
      }
      let snapshot: AlertSnapshot = await this.alertSnapshotDB.create(payload, queryRunner);
      let brokerData: number[] = await this.alertSnapshotDB.getBrokerId(payload.market);
      let userTradingAccounts: {
    userId: number;
    id: number;
}[] = await this.tradingAccountService.getAllCopyTradingAccounts(payload.userId, brokerData);
      let tradeSignalPayload: ICreateTradeSignal[] = []
      if(userTradingAccounts.length > 0) {
        tradeSignalPayload = userTradingAccounts.map(account => ({
          userId: account.userId,
          tradingAccountId: account.id,
          alertSnapshotsId: snapshot.id,
          action: payload.action,
          symbol: payload.ticker,
          price: payload.close,
          exchange: payload.exchange,
          signalTime: payload.alertTime,
          volume: payload.volume,
          assetType: assetType as any,
        })) 
      }
      await this.tradeSignalService.createTradeSignal(tradeSignalPayload, queryRunner);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
  async isValidAssetType(payload: ICreateAlertSnapshot) {
    try {
        let assetType = AssetClassifier.detect({
          symbol: payload.ticker,
          exchange: payload.exchange,
        });
        if (assetType === AssetType.UNKNOWN) {
          throw {
            status: HttpStatusCode._BAD_REQUEST,
            message: "unsupported_asset_type",
          };
        }
        return assetType;
    } catch (error) {
      throw error;
    }
  }

  async getAlertHistory(userId: number, query: HistoryQuery) {
    try {
      const data = await this.alertSnapshotDB.getAlertHistory(userId, query);
      return data;
    } catch (error) {
      throw error;
    }
  }

  

}
