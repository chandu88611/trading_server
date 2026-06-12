"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZebuDB = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = __importDefault(require("../../../db/data-source"));
const UserTradingAccount_1 = require("../../../entity/UserTradingAccount");
const TradeSignals_1 = require("../../../entity/TradeSignals");
const TradeSignalsStatus_1 = require("../../../entity/TradeSignalsStatus");
const ZebuProtectionMonitor_1 = require("../../../entity/ZebuProtectionMonitor");
class ZebuDB {
    constructor() {
        this.accountRepo = data_source_1.default.getRepository(UserTradingAccount_1.UserTradingAccount);
        this.tradeSignalRepo = data_source_1.default.getRepository(TradeSignals_1.TradeSignal);
        this.tradeSignalStatusRepo = data_source_1.default.getRepository(TradeSignalsStatus_1.TradeSignalStatus);
        this.protectionMonitorRepo = data_source_1.default.getRepository(ZebuProtectionMonitor_1.ZebuProtectionMonitor);
    }
    async ensureSchema() {
        const statements = [
            `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS broker_order_id BIGINT;`,
            `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS broker_position_id BIGINT;`,
            `ALTER TABLE trade_signals_status ADD COLUMN IF NOT EXISTS last_error TEXT;`,
            `ALTER TABLE trade_signals_status ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;`,
            `
			CREATE TABLE IF NOT EXISTS zebu_protection_monitors (
				id BIGSERIAL PRIMARY KEY,
				trade_signal_id BIGINT NOT NULL UNIQUE REFERENCES trade_signals(id) ON DELETE CASCADE,
				user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				trading_account_id BIGINT NOT NULL REFERENCES user_trading_accounts(id) ON DELETE CASCADE,
				symbol VARCHAR(80) NOT NULL,
				exchange VARCHAR(20) NOT NULL,
				side VARCHAR(10) NOT NULL CHECK (side IN ('BUY', 'SELL')),
				entry_ref VARCHAR(100),
				quantity NUMERIC(20, 6) NOT NULL,
				product VARCHAR(20),
				validity VARCHAR(20),
				entry_order_id BIGINT NOT NULL,
				stop_order_id BIGINT,
				target_order_id BIGINT,
				token VARCHAR(60),
				tick_size NUMERIC(18, 8),
				entry_price NUMERIC(15, 6),
				stop_loss NUMERIC(15, 6),
				take_profit NUMERIC(15, 6),
				stop_loss_distance NUMERIC(15, 6),
				take_profit_distance NUMERIC(15, 6),
				break_even_activation_distance NUMERIC(15, 6),
				break_even_offset_distance NUMERIC(15, 6),
				trailing_stop_loss_distance NUMERIC(15, 6),
				current_stop_price NUMERIC(15, 6),
				best_price NUMERIC(15, 6),
				monitor_status VARCHAR(20) NOT NULL DEFAULT 'pending_fill'
					CHECK (monitor_status IN ('pending_fill', 'active', 'closing', 'completed', 'failed', 'disabled')),
				last_error TEXT,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			);
			`,
            `CREATE INDEX IF NOT EXISTS idx_zebu_protection_monitors_status_updated_at ON zebu_protection_monitors (monitor_status, updated_at DESC);`,
            `CREATE INDEX IF NOT EXISTS idx_zebu_protection_monitors_account_symbol ON zebu_protection_monitors (trading_account_id, symbol, exchange);`,
            `ALTER TABLE zebu_protection_monitors ADD COLUMN IF NOT EXISTS stop_loss NUMERIC(15, 6);`,
            `ALTER TABLE zebu_protection_monitors ADD COLUMN IF NOT EXISTS take_profit NUMERIC(15, 6);`,
            `ALTER TABLE zebu_protection_monitors ADD COLUMN IF NOT EXISTS product VARCHAR(20);`,
            `ALTER TABLE zebu_protection_monitors ADD COLUMN IF NOT EXISTS validity VARCHAR(20);`,
            `ALTER TABLE zebu_protection_monitors ADD COLUMN IF NOT EXISTS current_stop_price NUMERIC(15, 6);`,
            `ALTER TABLE zebu_protection_monitors ADD COLUMN IF NOT EXISTS best_price NUMERIC(15, 6);`,
        ];
        for (const sql of statements) {
            await data_source_1.default.query(sql);
        }
    }
    async getTradingAccountById(userId, id) {
        return this.accountRepo.findOne({
            where: { id, userId },
            relations: ["broker"],
        });
    }
    async updateAccountMeta(account, metaPatch) {
        const nextMeta = { ...(account.accountMeta ?? {}), ...metaPatch };
        account.accountMeta = nextMeta;
        return this.accountRepo.save(account);
    }
    async markJobInProgress(job) {
        await this.tradeSignalRepo.manager.query(`UPDATE trade_signals_status SET status='in_progress' WHERE id=$1`, [job.status.id]);
    }
    async markJobSuccess(job) {
        await this.tradeSignalRepo.manager.query(`UPDATE trade_signals_status SET status='completed', last_error=NULL, next_retry_at=NULL WHERE id=$1`, [job.status.id]);
    }
    async markJobClosed(job) {
        await this.tradeSignalRepo.manager.query(`UPDATE trade_signals_status SET status='closed', last_error=NULL, next_retry_at=NULL WHERE id=$1`, [job.status.id]);
    }
    async markJobFailed(job, error) {
        await this.tradeSignalRepo.manager.query(`
			UPDATE trade_signals_status
			SET status='failed',
					attempts=attempts+1,
					last_error=$2,
					next_retry_at=NULL
			WHERE id=$1
			`, [job.status.id, String(error ?? "execution_failed")]);
    }
    async claimPendingTrades(limit) {
        const qr = data_source_1.default.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        try {
            const statusRepo = qr.manager.getRepository(TradeSignalsStatus_1.TradeSignalStatus);
            const qb = statusRepo
                .createQueryBuilder("s")
                .select("s.tradeSignalId", "id")
                .innerJoin("s.tradeSignal", "ts")
                .innerJoin("ts.tradingAccount", "ta")
                .innerJoin("ta.broker", "b")
                .where("s.status = :status", { status: "pending" })
                .andWhere("(b.code = :code OR b.name = :name)", { code: "ZEBU", name: "Zebu" })
                .orderBy("s.tradeSignalId", "ASC")
                .limit(limit)
                .setLock("pessimistic_write");
            if (typeof qb.setOnLocked === "function")
                qb.setOnLocked("skip_locked");
            const rows = await qb.getRawMany();
            const ids = rows.map((r) => Number(r.id)).filter(Boolean);
            if (!ids.length) {
                await qr.commitTransaction();
                return [];
            }
            await statusRepo
                .createQueryBuilder()
                .update(TradeSignalsStatus_1.TradeSignalStatus)
                .set({ status: "in_progress", updatedAt: new Date() })
                .where("tradeSignalId IN (:...ids)", { ids })
                .execute();
            const signals = await qr.manager
                .getRepository(TradeSignals_1.TradeSignal)
                .createQueryBuilder("ts")
                .leftJoinAndSelect("ts.tradingAccount", "ta")
                .leftJoinAndSelect("ta.broker", "b")
                .leftJoinAndSelect("ts.status", "tss")
                .where("ts.id IN (:...ids)", { ids })
                .andWhere("(b.code = :code OR b.name = :name)", { code: "ZEBU", name: "Zebu" })
                .getMany();
            await qr.commitTransaction();
            return signals;
        }
        catch (e) {
            await qr.rollbackTransaction();
            throw e;
        }
        finally {
            await qr.release();
        }
    }
    async claimPendingCloseTrades(limit) {
        const qr = data_source_1.default.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        try {
            const statusRepo = qr.manager.getRepository(TradeSignalsStatus_1.TradeSignalStatus);
            const qb = statusRepo
                .createQueryBuilder("s")
                .select("s.tradeSignalId", "id")
                .innerJoin("s.tradeSignal", "ts")
                .innerJoin("ts.tradingAccount", "ta")
                .innerJoin("ta.broker", "b")
                .where("s.status = :status", { status: "pending_close" })
                .andWhere("(b.code = :code OR b.name = :name)", { code: "ZEBU", name: "Zebu" })
                .orderBy("s.tradeSignalId", "ASC")
                .limit(limit)
                .setLock("pessimistic_write");
            if (typeof qb.setOnLocked === "function")
                qb.setOnLocked("skip_locked");
            const rows = await qb.getRawMany();
            const ids = rows.map((r) => Number(r.id)).filter(Boolean);
            if (!ids.length) {
                await qr.commitTransaction();
                return [];
            }
            await statusRepo
                .createQueryBuilder()
                .update(TradeSignalsStatus_1.TradeSignalStatus)
                .set({ status: "in_progress", updatedAt: new Date() })
                .where("tradeSignalId IN (:...ids)", { ids })
                .execute();
            const signals = await qr.manager
                .getRepository(TradeSignals_1.TradeSignal)
                .createQueryBuilder("ts")
                .leftJoinAndSelect("ts.tradingAccount", "ta")
                .leftJoinAndSelect("ta.broker", "b")
                .leftJoinAndSelect("ts.status", "tss")
                .where("ts.id IN (:...ids)", { ids })
                .andWhere("(b.code = :code OR b.name = :name)", { code: "ZEBU", name: "Zebu" })
                .getMany();
            await qr.commitTransaction();
            return signals;
        }
        catch (e) {
            await qr.rollbackTransaction();
            throw e;
        }
        finally {
            await qr.release();
        }
    }
    async claimProtectionMonitors(limit) {
        const qr = data_source_1.default.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        try {
            const monitorRepo = qr.manager.getRepository(ZebuProtectionMonitor_1.ZebuProtectionMonitor);
            const statuses = ["pending_fill", "active", "closing"];
            const qb = monitorRepo
                .createQueryBuilder("m")
                .select("m.id", "id")
                .where("m.monitorStatus IN (:...statuses)", { statuses })
                .orderBy("m.updatedAt", "ASC")
                .limit(limit)
                .setLock("pessimistic_write");
            if (typeof qb.setOnLocked === "function")
                qb.setOnLocked("skip_locked");
            const rows = await qb.getRawMany();
            const ids = rows.map((r) => Number(r.id)).filter(Boolean);
            if (!ids.length) {
                await qr.commitTransaction();
                return [];
            }
            await monitorRepo
                .createQueryBuilder()
                .update(ZebuProtectionMonitor_1.ZebuProtectionMonitor)
                .set({ updatedAt: new Date() })
                .where("id IN (:...ids)", { ids })
                .execute();
            const monitors = await monitorRepo.find({ where: { id: (0, typeorm_1.In)(ids) } });
            await qr.commitTransaction();
            const map = new Map(monitors.map((m) => [Number(m.id), m]));
            return ids.map((id) => map.get(id)).filter(Boolean);
        }
        catch (e) {
            await qr.rollbackTransaction();
            throw e;
        }
        finally {
            await qr.release();
        }
    }
    async createProtectionMonitor(data) {
        const tradeSignalId = Number(data.tradeSignalId);
        const existing = Number.isFinite(tradeSignalId) && tradeSignalId > 0
            ? await this.protectionMonitorRepo.findOne({ where: { tradeSignalId } })
            : null;
        const entity = existing
            ? this.protectionMonitorRepo.merge(existing, data)
            : this.protectionMonitorRepo.create(data);
        return this.protectionMonitorRepo.save(entity);
    }
    async updateProtectionMonitor(id, patch) {
        await this.protectionMonitorRepo.update(id, {
            ...patch,
            updatedAt: new Date(),
        });
    }
    async findProtectionMonitorByTradeSignalId(tradeSignalId) {
        if (!Number.isFinite(tradeSignalId) || tradeSignalId <= 0)
            return null;
        return this.protectionMonitorRepo.findOne({ where: { tradeSignalId } });
    }
    async markProtectionFailed(monitor, error) {
        await this.updateProtectionMonitor(monitor.id, {
            monitorStatus: "failed",
            lastError: String(error ?? "zebu_protection_failed"),
        });
    }
    async updateTradeStatus(data) {
        const ids = data.map((d) => d.id).filter(Boolean);
        if (!ids.length)
            return;
        const jobs = await this.tradeSignalRepo.find({
            where: { id: (0, typeorm_1.In)(ids) },
            relations: ["status"],
        });
        const jobMap = new Map(jobs.map((j) => [j.id, j]));
        await Promise.all(data.map(async (item) => {
            const job = jobMap.get(item.id);
            if (!job?.status?.id)
                return;
            const status = String(item.status ?? "").toLowerCase();
            if (status === "in_progress" || status === "processing") {
                if (item.brokerOrderId !== undefined) {
                    job.brokerOrderId =
                        item.brokerOrderId === null ? null : String(item.brokerOrderId);
                    await this.tradeSignalRepo.save(job);
                }
                await this.markJobInProgress(job);
                return;
            }
            if (status === "completed" || status === "success" || status === "executed") {
                if (item.brokerOrderId !== undefined) {
                    job.brokerOrderId =
                        item.brokerOrderId === null ? null : String(item.brokerOrderId);
                    await this.tradeSignalRepo.save(job);
                }
                await this.markJobSuccess(job);
                return;
            }
            if (status === "failed" || status === "error") {
                await this.markJobFailed(job, item.error ?? "execution_failed");
                return;
            }
            if (status === "closed") {
                await this.markJobClosed(job);
                return;
            }
            await this.tradeSignalStatusRepo
                .createQueryBuilder()
                .update(TradeSignalsStatus_1.TradeSignalStatus)
                .set({ status: item.status, updatedAt: new Date() })
                .where("tradeSignalId = :id", { id: item.id })
                .execute();
        }));
    }
    /** Load user email+name for a given trade signal — used for trade notifications */
    async getUserEmailForSignal(signalId) {
        try {
            const rows = await data_source_1.default.query(`SELECT u.email, u.name
				 FROM trade_signals ts
				 JOIN users u ON u.id = ts.user_id
				 WHERE ts.id = $1 LIMIT 1`, [signalId]);
            return rows[0] ?? null;
        }
        catch {
            return null;
        }
    }
}
exports.ZebuDB = ZebuDB;
