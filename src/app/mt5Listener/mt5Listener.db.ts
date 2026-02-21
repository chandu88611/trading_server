import { DataSource, Repository } from "typeorm";
import { Broker } from "../../entity/Brokers";
import { UserTradingAccount } from "../../entity/UserTradingAccount";
import { TradeSignal } from "../../entity/TradeSignals";

export class Mt5ListenerDBServices {
  private broker:Repository<Broker>;
  private userTradingAccount:Repository<UserTradingAccount>;
  private tradeSignal:Repository<TradeSignal>;

  constructor(private readonly dataSource: DataSource) {
    this.broker = this.dataSource.getRepository(Broker);
    this.userTradingAccount = this.dataSource.getRepository(UserTradingAccount);
    this.tradeSignal = this.dataSource.getRepository(TradeSignal);
  }

  async getNextPendingJob(brokerAccountId: string) {
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

  async getJobBySignalId(signalId: number) {
    if (!Number.isFinite(signalId) || signalId <= 0) return null;

    return this.tradeSignal.findOne({
      where: { id: signalId },
      relations: ["status"],
    });
  }

  async markJobInProgress(job: TradeSignal) {
    const currentStatus = String(job.status?.status ?? "").toLowerCase();
    const nextStatus = currentStatus === "pending_close" ? "in_progress" : "in_progress";

    await this.dataSource.manager.query(
      `UPDATE trade_signals_status SET status=$2 WHERE id=$1`,
      [job.status.id, nextStatus]
    );
  }

  async markJobSuccess(job: TradeSignal, orderId?: number) {
    const hasValidOrderId = Number.isFinite(orderId) && Number(orderId) > 0;

    await this.dataSource.transaction(async (manager) => {
      if (hasValidOrderId) {
        await manager.query(
          `UPDATE trade_signals SET order_id=$2 WHERE id=$1`,
          [job.id, Math.trunc(Number(orderId))]
        );
      }

      await manager.query(
        `UPDATE trade_signals_status SET status='completed' WHERE id=$1`,
        [job.status.id]
      );
    });
  }

  async markJobCloseSuccess(job: TradeSignal, orderId?: number) {
    const hasValidOrderId = Number.isFinite(orderId) && Number(orderId) > 0;

    await this.dataSource.transaction(async (manager) => {
      if (hasValidOrderId) {
        await manager.query(
          `UPDATE trade_signals SET order_id=$2 WHERE id=$1`,
          [job.id, Math.trunc(Number(orderId))]
        );
      }

      await manager.query(
        `UPDATE trade_signals_status SET status='closed' WHERE id=$1`,
        [job.status.id]
      );
    });
  }

  async markJobFailed(job: TradeSignal, error: string) {
    await this.dataSource.manager.query(
      `
      UPDATE trade_signals_status
      SET status='failed',
          last_error=$2,
          attempts=attempts+1
      WHERE id=$1
      `,
      [job.status.id, error]
    );
  }
}
