// src/app/trade/services/tradeGuard.service.ts
import AppDataSource from "../../../db/data-source";
import { AssetClassifier, AssetType } from "../../../types/trade-identify";
import { UserSubscriptionDBService } from "../../userSubscription/services/userSubscription.db";
import { HttpStatusCode } from "../../../types/constants";
import { User } from "../../../entity";

export type TradeCheckInput = {
  userId: number;
  symbol: string;
  exchange?: string | null;
  notional?: number | null;     // total value of trade, if you compute it
  lotSize?: number | null;
};

export type TradeCheckResult = {
  allowed: boolean;
  reason?: string;
  subscriptionId?: number | null;
};

export class TradeGuardService {
  private userRepo = AppDataSource.getRepository(User);
  private subDB = new UserSubscriptionDBService();

  async checkTradeAllowed(input: TradeCheckInput): Promise<TradeCheckResult> {
    try {
      const { userId, symbol, exchange } = input;

      // 1) user + allowTrade
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "user_not_found",
        };
      }

      if (!user.allowTrade) {
        return { allowed: false, reason: "trade_not_allowed_for_user" };
      }

      // 2) detect asset type from symbol
      const assetType = AssetClassifier.detect({ symbol, exchange });

      if (assetType === AssetType.UNKNOWN) {
        return { allowed: false, reason: "unknown_asset_type" };
      }

      // 3) active subscription for this market?
      const sub = await this.subDB.subscriberPlanValidation(userId, assetType);
      if (!sub) {
        return {
          allowed: false,
          reason: "no_active_subscription_for_market",
        };
      }

      // 4) (optional) later: pull PlanLimits and enforce:
      //    - maxConnectedAccounts
      //    - maxTradesPerWeek
      //    - maxDailyTrade
      //    - maxLotPerTrade
      // For now we just say YES if subscription exists.
      return {
        allowed: true,
        subscriptionId: sub.id,
      };
    } catch (error) {
      if (error instanceof Object && 'statusCode' in error) {
        throw error;
      }
      throw {
        statusCode: HttpStatusCode._INTERNAL_SERVER_ERROR,
        message: "failed_to_check_trade_allowed",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
