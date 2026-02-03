import AppDataSource from "../../../../db/data-source";
import { ForexTradeCategory } from "../../../../entity";
import { HttpStatusCode } from "../../../../types/constants";
import { AssetClassifier, AssetType } from "../../../../types/trade-identify";
import { CopyTradingService } from "../../../copyTrading/services/copyTrading.service";
import { CTraderService } from "../../../cTraderListener/services/cTrader";
import { UserSubscriptionService } from "../../../userSubscription/services/userSubscription";
import { BrokerCredentialService } from "../../brokerCredentials/services/brokerCredential.service";
import { BrokerJobService } from "../../brokerJobs/services/brokerJob.service";
import { ICreateTradeSignal } from "../../brokerSignals/interfaces/tradeSignal.interface";
import { TradeSignalService } from "../../brokerSignals/services/tradeSignal.service";
import { AlertSnapshotDB } from "../db/alertSnapshot.db";
import {
  HistoryQuery,
  ICreateAlertSnapshot,
  TimelineQuery,
} from "../interfaces/alertSnapshot.interface";

export class AlertSnapshotService {
  private alertSnapshotDB: AlertSnapshotDB;
  private brokerJobService: BrokerJobService;
  private brokerCredentialService: BrokerCredentialService;
  private tradeSignalService: TradeSignalService;
  private cTraderService: CTraderService;
  private userSubscriptionService: UserSubscriptionService;
  private copyTradingService: CopyTradingService;
  constructor() {
    this.alertSnapshotDB = new AlertSnapshotDB();
    this.brokerJobService = new BrokerJobService();
    this.brokerCredentialService = new BrokerCredentialService();
    this.tradeSignalService = new TradeSignalService();
    this.userSubscriptionService = new UserSubscriptionService();
    this.copyTradingService = new CopyTradingService();
    this.cTraderService = new CTraderService();
  }
  async create(payload: ICreateAlertSnapshot) {
    const queryRunner = AppDataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      let credentialdata: {id: number, keyName: string | null}[] =
        await this.brokerCredentialService.getCredentialIdByUserId(
          payload.userId
        );
      let credentialTypes: ForexTradeCategory[] =  await this.brokerCredentialService.getTypeOfBrokerByUserId(payload.userId);
      console.log("Fetched credential data:", credentialTypes);
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
      let isValidPlan =
        await this.userSubscriptionService.subscriberPlanValidation(
          payload.userId,
          assetType
        );
      if (!isValidPlan) {
        throw {
          status: HttpStatusCode._BAD_REQUEST,
          message: "invalid_subscription_plan",
        };
      }
      let mt5BrokerIds: number[] = [];
      let cTraderBrokerIds: number[] = [];
      let credentialId: number[] = [];
      if (credentialdata && credentialdata.length > 0) {
        for (let cred of credentialdata){

let dataId = await this.brokerJobService.getOrCreateBrokerJobId(
            {
              credentialId: cred.id,
              type: "trade",
              payload,
            },
            queryRunner
          );
          console.log("Created broker job id:", dataId, "for credential:", cred);
          if(cred.keyName === "MT5"){
            mt5BrokerIds.push(dataId);


          credentialId.push(dataId);
          } else if(cred.keyName === "CT"){
            cTraderBrokerIds.push(dataId);
          }
        }
        if (credentialId && credentialId.length > 0) {
          let brockerJobId = credentialId[0];
          let alertData = await this.alertSnapshotDB.create(
            payload,
            brockerJobId,
            queryRunner
          );
          let tradePayload: ICreateTradeSignal = {
            jobId: mt5BrokerIds[0],
            action: payload.action,
            symbol: alertData.ticker,
            price: alertData.close,
            exchange: alertData.exchange,
            signalTime: alertData.createdAt!,
          };
          if(credentialTypes.includes(ForexTradeCategory.MT5)){
          await this.tradeSignalService.createTradeSignal(
            tradePayload,
            queryRunner
          );
        }
          if(credentialTypes.includes(ForexTradeCategory.CTrader)){
            tradePayload.jobId = cTraderBrokerIds[0];
            console.log("Creating cTrader trade signal with payload:", tradePayload);
          await this.cTraderService.createTradeSignal(tradePayload, queryRunner);
        }
          // await this.copyTradingService.fanoutFromMasterSignal(
          //   {
          //     userId: payload.userId,
          //     brokerJobId: brockerJobId,
          //     alertSnapshotId: alertData.id,
          //     action: payload.action,
          //     symbol: alertData.ticker,
          //     exchange: alertData.exchange,
          //     price: alertData.close,
          //     signalTime: alertData.createdAt!,
          //   },
          //   queryRunner
          // );
          await queryRunner.commitTransaction();
          return alertData;
        } else {
          console.log("No valid broker job IDs created.", credentialId);
          throw {
            status: HttpStatusCode._BAD_REQUEST,
            message: "broker_job_creation_failed",
          };
        }
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getAlertHistory(userId: number, q: HistoryQuery) {
    if (!userId) {
      throw { status: HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
    }

    const page = Math.max(1, Number(q.page || 1));
    const limit = Math.min(200, Math.max(1, Number(q.limit || 20)));

    // resolve time window
    const { from, to } = this.resolveTimeWindow(q.from, q.to, q.lastMinutes);

    return this.alertSnapshotDB.getHistory({
      userId,
      page,
      limit,
      ticker: q.ticker,
      exchange: q.exchange,
      interval: q.interval,
      jobId: q.jobId,
      from,
      to,
    });
  }

  async getAlertTimeline(userId: number, q: TimelineQuery) {
    if (!userId) {
      throw { status: HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
    }

    const { from, to } = this.resolveTimeWindow(q.from, q.to, q.lastMinutes);

    return this.alertSnapshotDB.getTimeline({
      userId,
      bucket: q.bucket || "15m",
      ticker: q.ticker,
      exchange: q.exchange,
      interval: q.interval,
      jobId: q.jobId,
      from,
      to,
    });
  }

  private resolveTimeWindow(from?: string, to?: string, lastMinutes?: number) {
    if (lastMinutes && lastMinutes > 0) {
      const end = new Date();
      const start = new Date(Date.now() - lastMinutes * 60 * 1000);
      return { from: start, to: end };
    }

    const end = to ? new Date(to) : new Date();
    const start = from ? new Date(from) : new Date(Date.now() - 60 * 60 * 1000); // default last 1 hour

    return { from: start, to: end };
  }

  async listByJob(jobId: number) {
    return this.alertSnapshotDB.listByJob(jobId);
  }

  async getOpenJobs(
    userId: number,
    q: { page: number; limit: number; type?: string }
  ) {
    try {
      return this.alertSnapshotDB.getOpenJobs(userId, q);
    } catch (error) {
      throw error;
    }
  }
}
