import { QueryRunner, Repository } from "typeorm";
import AppDataSource from "../../../db/data-source";
import { SubscriberTradeAlert } from "../../../entity/SubscriberTradeAlert";
import { TradeSignal } from "../../../entity/TradeSignals";
import { HttpStatusCode } from "../../../types/constants";

export type SubscriberTradeAlertListQuery = {
  start: number;
  count: number;
  unreadOnly?: boolean;
};

export class TradeAlertDBService {
  private repo: Repository<SubscriberTradeAlert>;

  constructor() {
    this.repo = AppDataSource.getRepository(SubscriberTradeAlert);
  }

  async ensureSchema() {
    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS subscriber_trade_alerts (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        trade_signal_id INT NOT NULL UNIQUE REFERENCES trade_signals(id) ON DELETE CASCADE,
        subscription_id BIGINT REFERENCES user_subscriptions(id) ON DELETE SET NULL,
        trading_account_id BIGINT NOT NULL REFERENCES user_trading_accounts(id) ON DELETE CASCADE,
        admin_strategy_trade_id BIGINT REFERENCES admin_strategy_trades(id) ON DELETE SET NULL,
        event_type VARCHAR(30) NOT NULL DEFAULT 'trade_placed',
        action VARCHAR(10) NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        exchange VARCHAR(50) NOT NULL,
        price NUMERIC(10, 5) NOT NULL,
        volume NUMERIC(20, 2) NOT NULL,
        signal_time TIMESTAMPTZ NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_subscriber_trade_alerts_user_created_at
      ON subscriber_trade_alerts(user_id, created_at DESC);
    `);
    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_subscriber_trade_alerts_user_is_read_created_at
      ON subscriber_trade_alerts(user_id, is_read, created_at DESC);
    `);
    await AppDataSource.query(`
      DROP TRIGGER IF EXISTS set_timestamp_subscriber_trade_alerts
      ON subscriber_trade_alerts;
    `);
    await AppDataSource.query(`
      CREATE TRIGGER set_timestamp_subscriber_trade_alerts
      BEFORE UPDATE ON subscriber_trade_alerts
      FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
    `);
  }

  async createForTradeSignals(signals: TradeSignal[], queryRunner: QueryRunner) {
    const newTradeSignals = signals.filter((signal) => {
      const action = String(signal.action ?? "").toUpperCase();
      const executionMode = String(signal.executionMode ?? "").toUpperCase();
      return (action === "BUY" || action === "SELL") && executionMode !== "AMEND_SLTP";
    });

    if (!newTradeSignals.length) {
      return [];
    }

    const entities = queryRunner.manager.getRepository(SubscriberTradeAlert).create(
      newTradeSignals.map((signal) => ({
        userId: Number(signal.userId),
        tradeSignalId: Number(signal.id),
        subscriptionId:
          signal.subscriptionId === undefined || signal.subscriptionId === null
            ? null
            : Number(signal.subscriptionId),
        tradingAccountId: Number(signal.tradingAccountId),
        adminStrategyTradeId:
          signal.adminStrategyTradeId === undefined || signal.adminStrategyTradeId === null
            ? null
            : Number(signal.adminStrategyTradeId),
        eventType: "trade_placed",
        action: signal.action,
        symbol: signal.symbol,
        exchange: signal.exchange,
        price: signal.price,
        volume: signal.volume,
        signalTime: signal.signalTime,
        isRead: false,
        readAt: null,
      }))
    );

    return queryRunner.manager.getRepository(SubscriberTradeAlert).save(entities);
  }

  async listForUser(userId: number, query: SubscriberTradeAlertListQuery) {
    const start = Number.isFinite(query.start) && query.start >= 0 ? query.start : 0;
    const count = Number.isFinite(query.count) && query.count > 0 ? query.count : 20;

    const qb = this.repo
      .createQueryBuilder("alert")
      .where("alert.userId = :userId", { userId })
      .orderBy("alert.createdAt", "DESC")
      .skip(start)
      .take(count);

    if (query.unreadOnly) {
      qb.andWhere("alert.isRead = false");
    }

    const [data, total] = await qb.getManyAndCount();
    const unreadCount = await this.repo.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return {
      data,
      pagination: {
        start,
        count,
        total,
      },
      unreadCount,
    };
  }

  async markRead(userId: number, alertId: number) {
    const alert = await this.repo.findOne({
      where: {
        id: alertId,
        userId,
      } as any,
    });

    if (!alert) {
      throw {
        statusCode: HttpStatusCode._NOT_FOUND,
        message: "trade_alert_not_found",
      };
    }

    if (!alert.isRead) {
      alert.isRead = true;
      alert.readAt = new Date();
      return this.repo.save(alert);
    }

    return alert;
  }

  async markAllRead(userId: number) {
    const result = await this.repo
      .createQueryBuilder()
      .update(SubscriberTradeAlert)
      .set({
        isRead: true,
        readAt: () => "COALESCE(read_at, now())",
      })
      .where("user_id = :userId", { userId })
      .andWhere("is_read = false")
      .execute();

    return {
      updatedCount: Number(result.affected ?? 0),
    };
  }
}
