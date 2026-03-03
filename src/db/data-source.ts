import "reflect-metadata";
import { DataSource } from "typeorm";
import dotenv from "dotenv";
import {
  User,
  AuthProvider,
  RefreshToken,
  SubscriptionInvoice,
  SubscriptionPayment,
  SubscriptionPlan,
  UserSubscription,
  UserEdgingStatus,

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
    User,
    AuthProvider,
    RefreshToken,
    AlertSnapshot,
    SubscriptionInvoice,
    SubscriptionPayment,
    SubscriptionPlan,
    TradeSignal,
    UserSubscription,
    UserEdgingStatus,
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
    Broker,
    CTraderSession,
    CTraderSymbol,
  ],
  migrations: [],
  subscribers: [],
});

export default AppDataSource;
