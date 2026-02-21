"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CTradeSignalDB = void 0;
const typeorm_1 = require("typeorm");
const TradeSignals_1 = require("../../../entity/TradeSignals");
const TradeSignalsStatus_1 = require("../../../entity/TradeSignalsStatus");
const UserTradingAccount_1 = require("../../../entity/UserTradingAccount");
const data_source_1 = __importDefault(require("../../../db/data-source"));
class CTradeSignalDB {
    constructor() {
        this.tradeSignalRepo = data_source_1.default.getRepository(TradeSignals_1.TradeSignal);
        this.tradeSignalStatusRepo = data_source_1.default.getRepository(TradeSignalsStatus_1.TradeSignalStatus);
        this.tradingAccountRepo = data_source_1.default.getRepository(UserTradingAccount_1.UserTradingAccount);
    }
    async getPendingSignalDetailsForCTrader() {
        try {
            return await this.tradeSignalRepo
                .createQueryBuilder("ts")
                .leftJoinAndSelect("ts.status", "tss")
                .leftJoinAndSelect("ts.tradingAccount", "ta")
                .leftJoinAndSelect("ta.broker", "b")
                .where("tss.status = :status", { status: "pending" })
                .andWhere("(b.code = :code OR b.name = :name)", { code: "CT", name: "CTrader" })
                .orderBy("ts.createdAt", "ASC")
                .getMany();
        }
        catch (error) {
            throw error;
        }
    }
    async markJobInProgress(job) {
        await this.tradeSignalRepo.manager.query(`UPDATE trade_signals_status SET status='in_progress' WHERE id=$1`, [job.status.id]);
    }
    async markJobSuccess(job) {
        await this.tradeSignalRepo.manager.query(`UPDATE trade_signals_status SET status='completed' WHERE id=$1`, [job.status.id]);
    }
    async markJobCloseSuccess(job) {
        await this.tradeSignalRepo.manager.query(`UPDATE trade_signals_status SET status='closed' WHERE id=$1`, [job.status.id]);
    }
    async markJobFailed(job, _error) {
        await this.tradeSignalRepo.manager.query(`
      UPDATE trade_signals_status
      SET status='failed',
          attempts=attempts+1
      WHERE id=$1
      `, [job.status.id]);
    }
    async updateTradingAccountTokens(tradingAccountId, accessToken, refreshToken) {
        const access = String(accessToken ?? "").trim();
        if (!Number.isFinite(tradingAccountId) || tradingAccountId <= 0 || !access)
            return;
        const patch = {
            accessToken: access,
        };
        const refresh = String(refreshToken ?? "").trim();
        if (refresh)
            patch.refreshToken = refresh;
        await this.tradingAccountRepo.update({ id: tradingAccountId }, patch);
    }
    async updateTradingAccountAccountId(tradingAccountId, accountId) {
        if (!Number.isFinite(tradingAccountId) ||
            tradingAccountId <= 0 ||
            !Number.isFinite(accountId) ||
            accountId <= 0) {
            return;
        }
        await this.tradingAccountRepo.update({ id: tradingAccountId }, { accountId: String(accountId) });
    }
    async getAllTradeTo({ start, count }) {
        const data = await this.tradeSignalRepo
            .createQueryBuilder("ts")
            .leftJoinAndSelect("ts.status", "tss")
            .leftJoinAndSelect("ts.tradingAccount", "ta")
            .leftJoinAndSelect("ta.broker", "b")
            .where("tss.status = :status", { status: "pending" })
            .andWhere("(b.code = :code OR b.name = :name)", { code: "CT", name: "CTrader" })
            .skip(start)
            .take(count)
            .getMany();
        return data;
    }
    async claimPendingTrades(limit) {
        const qr = data_source_1.default.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        try {
            const statusRepo = qr.manager.getRepository(TradeSignalsStatus_1.TradeSignalStatus);
            const qb = statusRepo
                .createQueryBuilder("s")
                .leftJoinAndSelect("s.tradeSignal", "ts")
                .leftJoinAndSelect("ts.tradingAccount", "ta")
                .leftJoinAndSelect("ta.broker", "b")
                .select("s.tradeSignalId", "id")
                .where("s.status = :status", { status: "pending" })
                .andWhere("b.code = :code", { code: "CT" })
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
            // Fetch signals
            const signals = await qr.manager
                .getRepository(TradeSignals_1.TradeSignal)
                .createQueryBuilder("ts")
                .leftJoinAndSelect("ts.tradingAccount", "ta")
                .leftJoinAndSelect("ta.broker", "b")
                .where("ts.id IN (:...ids)", { ids })
                .andWhere("(b.code = :code OR b.name = :name)", { code: "CT", name: "CTrader" })
                .getMany();
            // keep order as ids
            const map = new Map(signals.map((s) => [s.id, s]));
            const ordered = ids.map((id) => map.get(id)).filter(Boolean);
            const badIds = [];
            const structured = [];
            for (const s of ordered) {
                const userId = s?.userId;
                const tradingAccountId = Number(s?.tradingAccount?.id ?? s?.tradingAccountId);
                const accountId = Number(s?.tradingAccount?.accountId);
                const env = String(s?.tradingAccount?.accountMeta?.env ?? "").trim().toLowerCase();
                const accessToken = String(s?.tradingAccount?.accessToken ?? "").trim();
                const refreshToken = String(s?.tradingAccount?.refreshToken ?? "").trim();
                if (!userId ||
                    !Number.isFinite(Number(userId)) ||
                    !Number.isFinite(tradingAccountId) ||
                    tradingAccountId <= 0 ||
                    !Number.isFinite(accountId) ||
                    accountId <= 0 ||
                    !accessToken) {
                    badIds.push(s.id);
                    continue;
                }
                structured.push({
                    id: s.id,
                    jobId: Number(s.id),
                    tradingAccountId,
                    accountId,
                    ...((env === "demo" || env === "live") ? { env } : {}),
                    accessToken,
                    ...(refreshToken ? { refreshToken } : {}),
                    action: String(s.action),
                    symbol: String(s.symbol),
                    price: String(s.price), // numeric -> string
                    exchange: String(s.exchange),
                    assetType: String(s.assetType),
                    signalTime: s.signalTime instanceof Date ? s.signalTime.toISOString() : new Date(s.signalTime).toISOString(),
                    userId: Number(userId),
                });
            }
            // Any bad ones -> set status failed so they don’t keep getting re-claimed forever
            if (badIds.length) {
                await statusRepo
                    .createQueryBuilder()
                    .update(TradeSignalsStatus_1.TradeSignalStatus)
                    .set({ status: "failed", updatedAt: new Date() })
                    .where("tradeSignalId IN (:...ids)", { ids: badIds })
                    .execute();
            }
            await qr.commitTransaction();
            return structured;
        }
        catch (e) {
            await qr.rollbackTransaction();
            throw e;
        }
        finally {
            await qr.release();
        }
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
                await this.markJobInProgress(job);
                return;
            }
            if (status === "completed" || status === "success" || status === "executed") {
                if (item.orderId !== undefined) {
                    job.orderId = Number(item.orderId);
                    await this.tradeSignalRepo.save(job);
                }
                await this.markJobSuccess(job);
                return;
            }
            if (status === "closed") {
                await this.markJobCloseSuccess(job);
                return;
            }
            if (status === "failed" || status === "error") {
                await this.markJobFailed(job, item.error ?? "execution_failed");
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
    async claimPendingCloseTrades(limit) {
        const qr = data_source_1.default.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        try {
            const statusRepo = qr.manager.getRepository(TradeSignalsStatus_1.TradeSignalStatus);
            const qb = statusRepo
                .createQueryBuilder("s")
                .leftJoinAndSelect("s.tradeSignal", "ts")
                .leftJoinAndSelect("ts.tradingAccount", "ta")
                .leftJoinAndSelect("ta.broker", "b")
                .select("s.tradeSignalId", "id")
                .where("s.status = :status", { status: "pending_close" })
                .andWhere("b.code = :code", { code: "CT" })
                .orderBy("s.tradeSignalId", "ASC")
                .limit(limit)
                .setLock("pessimistic_write");
            if (typeof qb.setOnLocked === "function")
                qb.setOnLocked("skip_locked");
            const rows = await qb.getRawMany();
            //console.log("Claiming pending close trades", { rows });
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
            // Fetch signals with orderId
            const signals = await qr.manager
                .getRepository(TradeSignals_1.TradeSignal)
                .createQueryBuilder("ts")
                .leftJoinAndSelect("ts.tradingAccount", "ta")
                .leftJoinAndSelect("ta.broker", "b")
                .where("ts.id IN (:...ids)", { ids })
                .andWhere("(b.code = :code OR b.name = :name)", { code: "CT", name: "CTrader" })
                .getMany();
            // Keep order as ids
            const map = new Map(signals.map((s) => [s.id, s]));
            const ordered = ids.map((id) => map.get(id)).filter(Boolean);
            const badIds = [];
            const structured = [];
            for (const s of ordered) {
                const userId = Number(s?.userId);
                const orderId = s?.orderId;
                const tradingAccountId = Number(s?.tradingAccount?.id ?? s?.tradingAccountId);
                const accountId = Number(s?.tradingAccount?.accountId);
                const env = String(s?.tradingAccount?.accountMeta?.env ?? "").trim().toLowerCase();
                const accessToken = String(s?.tradingAccount?.accessToken ?? "").trim();
                const refreshToken = String(s?.tradingAccount?.refreshToken ?? "").trim();
                if (!Number.isFinite(userId) ||
                    userId <= 0 ||
                    !orderId ||
                    !Number.isFinite(Number(orderId)) ||
                    !Number.isFinite(tradingAccountId) ||
                    tradingAccountId <= 0 ||
                    !Number.isFinite(accountId) ||
                    accountId <= 0 ||
                    !accessToken) {
                    badIds.push(s.id);
                    continue;
                }
                structured.push({
                    id: s.id,
                    userId,
                    tradingAccountId,
                    accountId,
                    ...((env === "demo" || env === "live") ? { env } : {}),
                    accessToken,
                    ...(refreshToken ? { refreshToken } : {}),
                    orderId: Number(orderId),
                });
            }
            // Mark bad ones as failed
            if (badIds.length) {
                await statusRepo
                    .createQueryBuilder()
                    .update(TradeSignalsStatus_1.TradeSignalStatus)
                    .set({ status: "failed", updatedAt: new Date() })
                    .where("tradeSignalId IN (:...ids)", { ids: badIds })
                    .execute();
            }
            await qr.commitTransaction();
            return structured;
        }
        catch (e) {
            await qr.rollbackTransaction();
            throw e;
        }
        finally {
            await qr.release();
        }
    }
}
exports.CTradeSignalDB = CTradeSignalDB;
