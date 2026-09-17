import { MasterFollowerLink } from "../entity/MasterFollowerLink";
import { AdminStrategyTradeScheduleSetting } from "../entity/AdminStrategyTradeScheduleSetting";
import { TradeFill } from "../entity/TradeFill";
import "reflect-metadata";
import { DataSource } from "typeorm";
import dotenv from "dotenv";
import {
  User,
  AuthProvider,
  RefreshToken,
  SubscriptionInvoice,
  SubscriptionPayment,
  RazorpayOrder,
  SubscriptionPlan,
  PlanAdminWebhookToken,
  UserSubscription,
  UserEdgingStatus,
  UserRiskLimits,
  ReferralRewardCredit,
  WithdrawalRequest,
  WithdrawalSetting,
  AdminStrategyTrade,
  CrmSyncOutbox,
  SupportTicket,
  SupportTicketMessage,
  CTraderTrailingTakeProfitMonitor,
  Mt5Symbol,
  ZebuProtectionMonitor,
  SubscriberTradeAlert,
  BrokerInstrument,
} from "../entity";
import { AlertSnapshot } from "../entity/AlertSnapshots";
import { TradeSignal } from "../entity/TradeSignals";
import { UserBillingDetails } from "../entity/UserBillingDetails";
import { CopyTradingFollowers } from "../entity/CopyTradingFollow";
import { CopyTradingMaster } from "../entity/CopyTradingMaster";
import { UserTradingAccount } from "../entity/UserTradingAccount";
import { Strategy } from "../entity/Strategy";
import { PlanType } from "../entity/PlanType";
import { Market } from "../entity/Market";
import { PlanPricing } from "../entity/PlanPricing";
import { PlanLimits } from "../entity/PlanLimits";
import { PlanFeature } from "../entity/PlanFeature";
import { PlanBundleItem } from "../entity/PlanBundleItem";
import { PlanStrategy } from "../entity/PlanStrategy";
import { TradeSignalStatus } from "../entity/TradeSignalsStatus";
import { Broker } from "../entity/Brokers";
import { CTraderSession } from "../entity/CTraderSession";
import { CTraderSymbol } from "../entity/CTraderSymbol";
import { UserStrategyInstance } from "../entity/UserStrategyInstance";

dotenv.config();

const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5449;

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port,
  username: process.env.DB_USER || "kite",
  password: process.env.DB_PASSWORD || "kitepass",
  database: process.env.DB_NAME || "kite",
  synchronize: false,
  logging: false,
  entities: [
    MasterFollowerLink,
    TradeFill,
    User,
    AuthProvider,
    RefreshToken,
    AlertSnapshot,
    SubscriptionInvoice,
    SubscriptionPayment,
    RazorpayOrder,
    SubscriptionPlan,
    PlanAdminWebhookToken,
    TradeSignal,
    UserSubscription,
    UserEdgingStatus,
    UserRiskLimits,
    ReferralRewardCredit,
    WithdrawalRequest,
    WithdrawalSetting,
    AdminStrategyTradeScheduleSetting,
    AdminStrategyTrade,
    CrmSyncOutbox,
    SupportTicket,
    SupportTicketMessage,
    CTraderTrailingTakeProfitMonitor,
    SubscriberTradeAlert,
    UserBillingDetails,
    UserTradingAccount,
    CopyTradingFollowers,
    CopyTradingMaster,
    Strategy,
    TradeSignalStatus,
    PlanType,
    Market,
    PlanPricing,
    PlanLimits,
    PlanFeature,
    PlanBundleItem,
    PlanStrategy,
    UserStrategyInstance,
    Broker,
    CTraderSession,
    CTraderSymbol,
    Mt5Symbol,
    ZebuProtectionMonitor,
    BrokerInstrument,
  ],
  migrations: [],
  subscribers: [],
});

let initializePromise: Promise<DataSource> | null = null;

export async function ensureAppDataSourceInitialized(): Promise<DataSource> {
  if (AppDataSource.isInitialized) {
    return AppDataSource;
  }

  if (!initializePromise) {
    initializePromise = AppDataSource.initialize().catch((error) => {
      initializePromise = null;
      throw error;
    });
  }

  return initializePromise;
}

export default AppDataSource;
