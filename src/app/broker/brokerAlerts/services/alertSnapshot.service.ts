import AppDataSource from "../../../../db/data-source";
import { HttpStatusCode } from "../../../../types/constants";
import { AssetClassifier, AssetType } from "../../../../types/trade-identify";
import { UserSubscriptionService } from "../../../userSubscription/services/userSubscription";
import { BrokerCredentialService } from "../../brokerCredentials/services/brokerCredential.service";
import { BrokerJobService } from "../../brokerJobs/services/brokerJob.service";
import { ICreateTradeSignal } from "../../brokerSignals/interfaces/tradeSignal.interface";
import { TradeSignalService } from "../../brokerSignals/services/tradeSignal.service";
import { AlertSnapshotDB } from "../db/alertSnapshot.db";
import { ICreateAlertSnapshot } from "../interfaces/alertSnapshot.interface";

export class AlertSnapshotService {
  private alertSnapshotDB: AlertSnapshotDB;
  private brokerJobService: BrokerJobService;
  private brokerCredentialService: BrokerCredentialService;
  private tradeSignalService: TradeSignalService;
  private userSubscriptionService: UserSubscriptionService;
  constructor() {
    this.alertSnapshotDB = new AlertSnapshotDB();
    this.brokerJobService = new BrokerJobService();
    this.brokerCredentialService = new BrokerCredentialService();
    this.tradeSignalService = new TradeSignalService();
    this.userSubscriptionService = new UserSubscriptionService();
  }
  async create(payload: ICreateAlertSnapshot) {
    const queryRunner = AppDataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      let credentialId: number =
        await this.brokerCredentialService.getCredentialIdByUserId(
          payload.userId
        );
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
      if (credentialId && credentialId > 0 && credentialId !== undefined) {
        let brockerJobId: number =
          await this.brokerJobService.getOrCreateBrokerJobId(
            {
              credentialId: credentialId,
              type: "trade",
              payload,
            },
            queryRunner
          );
        if (brockerJobId && brockerJobId > 0 && brockerJobId !== undefined) {
          let alertData = await this.alertSnapshotDB.create(
            payload,
            brockerJobId,
            queryRunner
          );
          let tradePayload: ICreateTradeSignal = {
            jobId: brockerJobId,
            action: payload.action,
            symbol: alertData.ticker,
            price: alertData.close,
            exchange: alertData.exchange,
            signalTime: alertData.createdAt!,
          };

          await this.tradeSignalService.createTradeSignal(
            tradePayload,
            queryRunner
          );
          await queryRunner.commitTransaction();
          return alertData;
        } else {
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

  async listByJob(jobId: number) {
    return this.alertSnapshotDB.listByJob(jobId);
  }
}
