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
    .where("b.id = :brokerId", { brokerId: 1 })
    .andWhere("uta.account_id = :accountId", { accountId: brokerAccountId })
    .andWhere("tss.status = :status", { status: "pending" })
    .orderBy("trade_signal.created_at", "ASC")
    .getMany();


    return rows.length > 0 ? rows[0] : null;
  }

  async markJobInProgress(job: TradeSignal) {
    await this.dataSource.manager.query(
      `UPDATE trade_signals_status SET status='in_progress' WHERE id=$1`,
      [job.status.id]
    );
  }

  async markJobSuccess(job: TradeSignal) {
    await this.dataSource.manager.query(
      `UPDATE trade_signals_status SET status='completed' WHERE id=$1`,
      [job.status.id]
    );
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
