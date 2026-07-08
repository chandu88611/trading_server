"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertSnapshotDB = void 0;
const data_source_1 = __importDefault(require("../../../../db/data-source"));
const AlertSnapshots_1 = require("../../../../entity/AlertSnapshots");
const TradeSignals_1 = require("../../../../entity/TradeSignals");
const TradeSignalsStatus_1 = require("../../../../entity/TradeSignalsStatus");
const AdminStrategyTrade_1 = require("../../../../entity/AdminStrategyTrade");
const Brokers_1 = require("../../../../entity/Brokers");
const trade_identify_1 = require("../../../../types/trade-identify");
const constants_1 = require("../../../../types/constants");
class AlertSnapshotDB {
    constructor() {
        this.repo = data_source_1.default.getRepository(AlertSnapshots_1.AlertSnapshot);
        this.broker = data_source_1.default.getRepository(Brokers_1.Broker);
    }
    async ensureSchema() {
        const schema = [
            `
        CREATE TABLE IF NOT EXISTS admin_strategy_trades (
          id BIGSERIAL PRIMARY KEY,
          plan_id BIGINT NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
          strategy_id BIGINT NOT NULL REFERENCES strategies(id) ON DELETE RESTRICT,
          placed_by_admin_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
          source VARCHAR(30) NOT NULL DEFAULT 'plan_webhook',
          action VARCHAR(10) NOT NULL,
          symbol VARCHAR(20) NOT NULL,
          exchange VARCHAR(50),
          price NUMERIC(30, 8),
          execution_mode VARCHAR(20),
          entry_ref VARCHAR(100),
          order_type VARCHAR(20),
          limit_price NUMERIC(15, 6),
          stop_price NUMERIC(15, 6),
          stop_loss NUMERIC(15, 6),
          take_profit NUMERIC(15, 6),
          stop_loss_distance NUMERIC(15, 6),
          take_profit_distance NUMERIC(15, 6),
          stop_loss_amount NUMERIC(15, 6),
          take_profit_amount NUMERIC(15, 6),
          trailing_stop_loss BOOLEAN,
          guaranteed_stop_loss BOOLEAN,
          stop_loss_trigger_method VARCHAR(30),
          trailing_take_profit_activation_distance NUMERIC(15, 6),
          trailing_take_profit_distance NUMERIC(15, 6),
          break_even_activation_distance NUMERIC(15, 6),
          break_even_offset_distance NUMERIC(15, 6),
          trailing_stop_loss_distance NUMERIC(15, 6),
          trading_strength NUMERIC(15, 6),
          raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
          execution_allowed BOOLEAN NOT NULL DEFAULT FALSE,
          schedule_blocked BOOLEAN NOT NULL DEFAULT FALSE,
          schedule_window_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
          recipient_count INT NOT NULL DEFAULT 0,
          snapshot_count INT NOT NULL DEFAULT 0,
          signal_count INT NOT NULL DEFAULT 0,
          close_queued_count INT NOT NULL DEFAULT 0,
          status VARCHAR(30) NOT NULL DEFAULT 'received'
            CHECK (status IN ('received', 'blocked', 'fanned_out', 'no_signals', 'close_requested')),
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );
      `,
            `CREATE INDEX IF NOT EXISTS idx_admin_strategy_trades_strategy_created_at ON admin_strategy_trades(strategy_id, created_at DESC);`,
            `CREATE INDEX IF NOT EXISTS idx_admin_strategy_trades_plan_created_at ON admin_strategy_trades(plan_id, created_at DESC);`,
            `CREATE INDEX IF NOT EXISTS idx_admin_strategy_trades_status_created_at ON admin_strategy_trades(status, created_at DESC);`,
            `CREATE INDEX IF NOT EXISTS idx_admin_strategy_trades_entry_ref ON admin_strategy_trades(entry_ref);`,
            `DROP TRIGGER IF EXISTS set_timestamp_admin_strategy_trades ON admin_strategy_trades;`,
            `
        CREATE TRIGGER set_timestamp_admin_strategy_trades
        BEFORE UPDATE ON admin_strategy_trades
        FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
      `,
        ];
        const columns = [
            `ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS execution_mode VARCHAR(20);`,
            `ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS entry_ref VARCHAR(100);`,
            `ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS order_type VARCHAR(20);`,
            `ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS limit_price NUMERIC(15, 6);`,
            `ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS stop_price NUMERIC(15, 6);`,
            `ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS stop_loss NUMERIC(15, 6);`,
            `ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS take_profit NUMERIC(15, 6);`,
            `ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS stop_loss_distance NUMERIC(15, 6);`,
            `ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS take_profit_distance NUMERIC(15, 6);`,
            `ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS stop_loss_amount NUMERIC(15, 6);`,
            `ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS take_profit_amount NUMERIC(15, 6);`,
            `ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS trailing_stop_loss BOOLEAN;`,
            `ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS guaranteed_stop_loss BOOLEAN;`,
            `ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS stop_loss_trigger_method VARCHAR(30);`,
            `ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS trailing_take_profit_activation_distance NUMERIC(15, 6);`,
            `ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS trailing_take_profit_distance NUMERIC(15, 6);`,
            `ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS break_even_activation_distance NUMERIC(15, 6);`,
            `ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS break_even_offset_distance NUMERIC(15, 6);`,
            `ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS trailing_stop_loss_distance NUMERIC(15, 6);`,
            `ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS trading_strength NUMERIC(15, 6);`,
            `ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS admin_strategy_trade_id BIGINT REFERENCES admin_strategy_trades(id) ON DELETE SET NULL;`,
            `ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS strategy_id BIGINT REFERENCES strategies(id) ON DELETE SET NULL;`,
            `ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS plan_id BIGINT REFERENCES subscription_plans(id) ON DELETE SET NULL;`,
            `ALTER TABLE alert_snapshots ADD COLUMN IF NOT EXISTS subscription_id BIGINT REFERENCES user_subscriptions(id) ON DELETE SET NULL;`,
            `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS admin_strategy_trade_id BIGINT REFERENCES admin_strategy_trades(id) ON DELETE SET NULL;`,
            `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS strategy_id BIGINT REFERENCES strategies(id) ON DELETE SET NULL;`,
            `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS plan_id BIGINT REFERENCES subscription_plans(id) ON DELETE SET NULL;`,
            `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS subscription_id BIGINT REFERENCES user_subscriptions(id) ON DELETE SET NULL;`,
            // Indian-market instrument classification (explicit future/option/equity)
            `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS instrument_type VARCHAR(20);`,
            `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS product VARCHAR(20);`,
            `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS underlying VARCHAR(40);`,
            `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS expiry DATE;`,
            `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS option_type VARCHAR(4);`,
            `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS strike NUMERIC(15, 4);`,
            `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS trading_symbol VARCHAR(120);`,
            `ALTER TABLE trade_signals ALTER COLUMN trading_symbol TYPE VARCHAR(120);`,
            `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS source_action VARCHAR(10);`,
            `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS broker_instrument_id BIGINT;`,
            `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS instrument_token VARCHAR(80);`,
            `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS tick_size NUMERIC(18, 8);`,
            `CREATE INDEX IF NOT EXISTS idx_trade_signals_instrument_type ON trade_signals(instrument_type);`,
            `CREATE INDEX IF NOT EXISTS idx_alert_snapshots_admin_strategy_trade_id ON alert_snapshots(admin_strategy_trade_id);`,
            `CREATE INDEX IF NOT EXISTS idx_alert_snapshots_strategy_created_at ON alert_snapshots(strategy_id, created_at DESC);`,
            `CREATE INDEX IF NOT EXISTS idx_trade_signals_admin_strategy_trade_created_at ON trade_signals(admin_strategy_trade_id, created_at DESC);`,
            `CREATE INDEX IF NOT EXISTS idx_trade_signals_strategy_created_at ON trade_signals(strategy_id, created_at DESC);`,
        ];
        for (const sql of schema) {
            await data_source_1.default.query(sql);
        }
        for (const sql of columns) {
            await data_source_1.default.query(sql);
        }
    }
    async createAdminStrategyTrade(payload, queryRunner) {
        const entity = queryRunner.manager.getRepository(AdminStrategyTrade_1.AdminStrategyTrade).create({
            planId: payload.planId,
            strategyId: payload.strategyId,
            placedByAdminUserId: payload.placedByAdminUserId ?? null,
            source: payload.source ?? "plan_webhook",
            action: payload.action,
            symbol: payload.symbol,
            exchange: payload.exchange ?? null,
            price: payload.price ?? null,
            executionMode: payload.executionMode ?? null,
            entryRef: payload.entryRef ?? null,
            orderType: payload.orderType ?? null,
            limitPrice: payload.limitPrice ?? null,
            stopPrice: payload.stopPrice ?? null,
            stopLoss: payload.stopLoss ?? null,
            takeProfit: payload.takeProfit ?? null,
            stopLossDistance: payload.stopLossDistance ?? null,
            takeProfitDistance: payload.takeProfitDistance ?? null,
            stopLossAmount: payload.stopLossAmount ?? null,
            takeProfitAmount: payload.takeProfitAmount ?? null,
            trailingStopLoss: payload.trailingStopLoss ?? null,
            guaranteedStopLoss: payload.guaranteedStopLoss ?? null,
            stopLossTriggerMethod: payload.stopLossTriggerMethod ?? null,
            trailingTakeProfitActivationDistance: payload.trailingTakeProfitActivationDistance ?? null,
            trailingTakeProfitDistance: payload.trailingTakeProfitDistance ?? null,
            breakEvenActivationDistance: payload.breakEvenActivationDistance ?? null,
            breakEvenOffsetDistance: payload.breakEvenOffsetDistance ?? null,
            trailingStopLossDistance: payload.trailingStopLossDistance ?? null,
            tradingStrength: payload.tradingStrength ?? null,
            rawPayload: payload.rawPayload ?? {},
            executionAllowed: payload.executionAllowed,
            scheduleBlocked: payload.scheduleBlocked,
            scheduleWindowIds: payload.scheduleWindowIds,
            status: "received",
        });
        return queryRunner.manager.getRepository(AdminStrategyTrade_1.AdminStrategyTrade).save(entity);
    }
    async updateAdminStrategyTradeFanout(adminStrategyTradeId, payload, queryRunner) {
        await queryRunner.manager.getRepository(AdminStrategyTrade_1.AdminStrategyTrade).update({ id: adminStrategyTradeId }, {
            recipientCount: payload.recipientCount,
            snapshotCount: payload.snapshotCount,
            signalCount: payload.signalCount,
            status: payload.status,
        });
    }
    async create(payload, queryRunner) {
        try {
            const entity = queryRunner.manager
                .getRepository(AlertSnapshots_1.AlertSnapshot)
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
                executionMode: payload.executionMode ?? null,
                entryRef: payload.entryRef ?? null,
                orderType: payload.orderType ?? null,
                limitPrice: payload.limitPrice ?? null,
                stopPrice: payload.stopPrice ?? null,
                stopLoss: payload.stopLoss ?? null,
                takeProfit: payload.takeProfit ?? null,
                stopLossDistance: payload.stopLossDistance ?? null,
                takeProfitDistance: payload.takeProfitDistance ?? null,
                stopLossAmount: payload.stopLossAmount ?? null,
                takeProfitAmount: payload.takeProfitAmount ?? null,
                trailingStopLoss: payload.trailingStopLoss ?? null,
                guaranteedStopLoss: payload.guaranteedStopLoss ?? null,
                stopLossTriggerMethod: payload.stopLossTriggerMethod ?? null,
                trailingTakeProfitActivationDistance: payload.trailingTakeProfitActivationDistance ?? null,
                trailingTakeProfitDistance: payload.trailingTakeProfitDistance ?? null,
                breakEvenActivationDistance: payload.breakEvenActivationDistance ?? null,
                breakEvenOffsetDistance: payload.breakEvenOffsetDistance ?? null,
                trailingStopLossDistance: payload.trailingStopLossDistance ?? null,
                tradingStrength: payload.tradingStrength ?? null,
                adminStrategyTradeId: payload.adminStrategyTradeId ?? null,
                strategyId: payload.strategyId ?? null,
                planId: payload.planId ?? null,
                subscriptionId: payload.subscriptionId ?? null,
            });
            return await queryRunner.manager
                .getRepository(AlertSnapshots_1.AlertSnapshot)
                .save(entity);
        }
        catch (error) {
            throw error;
        }
    }
    async getAlertHistory(userId, query) {
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
    async getAdminAlertHistory(query) {
        const qb = this.repo.createQueryBuilder("snapshot");
        if (query.userId) {
            qb.where("snapshot.userId = :userId", { userId: query.userId });
        }
        if (query.planId) {
            qb.andWhere("snapshot.planId = :planId", { planId: query.planId });
        }
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
        const [data, total] = await qb
            .orderBy("snapshot.alertTime", "DESC")
            .skip((query.page - 1) * query.limit)
            .take(query.limit)
            .getManyAndCount();
        return { data, total, page: query.page, limit: query.limit };
    }
    async getBrokerId(marketType) {
        try {
            const brokerData = await this.broker.find({
                where: {
                    marketCategory: marketType,
                    isActive: true,
                },
            });
            if (!brokerData || brokerData.length === 0) {
                throw {
                    status: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "no_broker_found_for_market_type",
                };
            }
            return brokerData.map(broker => broker.id);
        }
        catch (error) {
            throw error;
        }
    }
    async getBrokerIdByCodes(marketType, codes) {
        const normalizedCodes = codes.map((code) => String(code).trim().toUpperCase()).filter(Boolean);
        if (!normalizedCodes.length) {
            return this.getBrokerId(marketType);
        }
        const brokerData = await this.broker
            .createQueryBuilder("broker")
            .where("broker.market_category = :marketType", { marketType })
            .andWhere("broker.is_active = true")
            .andWhere("UPPER(broker.code) IN (:...codes)", { codes: normalizedCodes })
            .getMany();
        if (!brokerData.length) {
            throw {
                status: constants_1.HttpStatusCode._NOT_FOUND,
                message: "no_broker_found_for_market_type",
            };
        }
        return brokerData.map((broker) => broker.id);
    }
    getMarketType(assetType) {
        switch (assetType) {
            case trade_identify_1.AssetType.FOREX:
                return trade_identify_1.MarketType.FOREX;
            case trade_identify_1.AssetType.CRYPTO:
                return trade_identify_1.MarketType.CRYPTO;
            default:
                return trade_identify_1.MarketType.INDIAN;
        }
    }
    async closeOppositeCompletedTrades({ tradingAccountIds, symbol, exchange, incomingAction, }, queryRunner) {
        if (!tradingAccountIds.length || !symbol?.trim())
            return 0;
        const oppositeAction = incomingAction === "BUY" ? "SELL" : "BUY";
        const signalIds = await queryRunner.manager
            .getRepository(TradeSignals_1.TradeSignal)
            .createQueryBuilder("ts")
            .innerJoin("ts.status", "tss")
            .where("ts.tradingAccountId IN (:...tradingAccountIds)", { tradingAccountIds })
            .andWhere("UPPER(ts.symbol) = UPPER(:symbol)", { symbol: symbol.trim() })
            .andWhere("UPPER(COALESCE(ts.sourceAction, ts.action)) = :oppositeAction", { oppositeAction })
            .andWhere("tss.status = :completedStatus", { completedStatus: "completed" })
            .andWhere("((ts.orderId IS NOT NULL AND ts.orderId > 0) OR (ts.brokerOrderId IS NOT NULL AND ts.brokerOrderId > 0) OR (ts.brokerPositionId IS NOT NULL AND ts.brokerPositionId > 0))")
            .andWhere(exchange?.trim() ? "UPPER(ts.exchange) = UPPER(:exchange)" : "1=1", {
            exchange: exchange?.trim(),
        })
            .select("ts.id", "id")
            .getRawMany();
        const ids = signalIds.map((row) => Number(row.id)).filter(Boolean);
        if (!ids.length)
            return 0;
        const result = await queryRunner.manager
            .getRepository(TradeSignalsStatus_1.TradeSignalStatus)
            .createQueryBuilder()
            .update(TradeSignalsStatus_1.TradeSignalStatus)
            .set({ status: "pending_close", updatedAt: new Date() })
            .where("tradeSignalId IN (:...ids)", { ids })
            .andWhere("status = :completedStatus", { completedStatus: "completed" })
            .execute();
        return Number(result.affected ?? 0);
    }
}
exports.AlertSnapshotDB = AlertSnapshotDB;
