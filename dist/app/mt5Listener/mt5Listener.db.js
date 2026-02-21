"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mt5ListenerDBServices = void 0;
const Brokers_1 = require("../../entity/Brokers");
const UserTradingAccount_1 = require("../../entity/UserTradingAccount");
const TradeSignals_1 = require("../../entity/TradeSignals");
class Mt5ListenerDBServices {
    constructor(dataSource) {
        this.dataSource = dataSource;
        this.broker = this.dataSource.getRepository(Brokers_1.Broker);
        this.userTradingAccount = this.dataSource.getRepository(UserTradingAccount_1.UserTradingAccount);
        this.tradeSignal = this.dataSource.getRepository(TradeSignals_1.TradeSignal);
    }
    async getNextPendingJob(brokerAccountId) {
        const rows = await this.tradeSignal.createQueryBuilder("trade_signal")
            .leftJoinAndSelect("trade_signal.tradingAccount", "uta")
            .leftJoinAndSelect("trade_signal.status", "tss")
            .leftJoinAndSelect("uta.broker", "b")
            .where("b.code = :code", { code: "MT5" })
            .andWhere("uta.account_id = :accountId", { accountId: brokerAccountId })
            .andWhere("tss.status IN (:...statuses)", { statuses: ["pending", "pending_close"] })
            .orderBy("trade_signal.created_at", "ASC")
            .getMany();
        return rows.length > 0 ? rows[0] : null;
    }
    async getJobBySignalId(signalId) {
        if (!Number.isFinite(signalId) || signalId <= 0)
            return null;
        return this.tradeSignal.findOne({
            where: { id: signalId },
            relations: ["status"],
        });
    }
    async markJobInProgress(job) {
        const currentStatus = String(job.status?.status ?? "").toLowerCase();
        const nextStatus = currentStatus === "pending_close" ? "in_progress" : "in_progress";
        await this.dataSource.manager.query(`UPDATE trade_signals_status SET status=$2 WHERE id=$1`, [job.status.id, nextStatus]);
    }
    async markJobSuccess(job, orderId) {
        const hasValidOrderId = Number.isFinite(orderId) && Number(orderId) > 0;
        await this.dataSource.transaction(async (manager) => {
            if (hasValidOrderId) {
                await manager.query(`UPDATE trade_signals SET order_id=$2 WHERE id=$1`, [job.id, Math.trunc(Number(orderId))]);
            }
            await manager.query(`UPDATE trade_signals_status SET status='completed' WHERE id=$1`, [job.status.id]);
        });
    }
    async markJobCloseSuccess(job, orderId) {
        const hasValidOrderId = Number.isFinite(orderId) && Number(orderId) > 0;
        await this.dataSource.transaction(async (manager) => {
            if (hasValidOrderId) {
                await manager.query(`UPDATE trade_signals SET order_id=$2 WHERE id=$1`, [job.id, Math.trunc(Number(orderId))]);
            }
            await manager.query(`UPDATE trade_signals_status SET status='closed' WHERE id=$1`, [job.status.id]);
        });
    }
    async markJobFailed(job, error) {
        await this.dataSource.manager.query(`
      UPDATE trade_signals_status
      SET status='failed',
          last_error=$2,
          attempts=attempts+1
      WHERE id=$1
      `, [job.status.id, error]);
    }
}
exports.Mt5ListenerDBServices = Mt5ListenerDBServices;
