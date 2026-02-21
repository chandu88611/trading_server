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
class ZebuDB {
    constructor() {
        this.accountRepo = data_source_1.default.getRepository(UserTradingAccount_1.UserTradingAccount);
        this.tradeSignalRepo = data_source_1.default.getRepository(TradeSignals_1.TradeSignal);
        this.tradeSignalStatusRepo = data_source_1.default.getRepository(TradeSignalsStatus_1.TradeSignalStatus);
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
        await this.tradeSignalRepo.manager.query(`UPDATE trade_signals_status SET status='completed' WHERE id=$1`, [job.status.id]);
    }
    async markJobFailed(job, error) {
        await this.tradeSignalRepo.manager.query(`
			UPDATE trade_signals_status
			SET status='failed',
					last_error=$2,
					attempts=attempts+1
			WHERE id=$1
			`, [job.status.id, error]);
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
                .where("s.status = :status", { status: "pending" })
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
                .set({ status: "processing", updatedAt: new Date() })
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
                await this.markJobSuccess(job);
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
}
exports.ZebuDB = ZebuDB;
