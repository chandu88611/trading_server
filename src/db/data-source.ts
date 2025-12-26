import "reflect-metadata";
import { DataSource } from "typeorm";
import dotenv from "dotenv";
import {
  User,
  AuthProvider,
  BrokerCredential,
  BrokerEvent,
  BrokerJob,
  BrokerSession,
  RefreshToken,
  SubscriptionInvoice,
  SubscriptionPayment,
  SubscriptionPlan,
  UserSubscription,
} from "../entity";
import { AlertSnapshot } from "../entity/AlertSnapshots";
import { TradeSignal } from "../entity/TradeSignals";
import { UserBillingDetails } from "../entity/UserBillingDetails";
import { CopyMasterEvent } from "../entity/CopyMasterEvent";
import { CopyTradeTask } from "../entity/CopyTradeTask";
import { CopyTradingFollow } from "../entity/CopyTradingFollow";
import { CopyTradingMaster } from "../entity/CopyTradingMaster";
import { UserTradingAccount } from "../entity/UserTradingAccount";
import { Strategy } from "../entity/Strategy";
import { ForexTraderUserDetails } from "../entity/ForexTraderUserDetails";

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
    BrokerCredential,
    BrokerSession,
    BrokerJob,
    BrokerEvent,
    RefreshToken,
    AlertSnapshot,
    SubscriptionInvoice,
    SubscriptionPayment,
    SubscriptionPlan,
    TradeSignal,
    UserSubscription,
    UserBillingDetails,
    UserTradingAccount,
    CopyMasterEvent,
    CopyTradeTask,
    CopyTradingFollow,
    CopyTradingMaster,
    Strategy,
    ForexTraderUserDetails
  ],
  migrations: [],
  subscribers: [],
});

export default AppDataSource;
