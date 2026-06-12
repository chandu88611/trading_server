import { DataSource, Repository } from "typeorm";
import { TradeSignal } from "../../entity/TradeSignals";
import { Mt5Symbol } from "../../entity";

export type Mt5BrokerRefs = {
  orderId?: number | string | null;
  brokerOrderId?: number | string | null;
  brokerPositionId?: number | string | null;
};

export class Mt5ListenerDBServices {
  private tradeSignal:Repository<TradeSignal>;
  private mt5SymbolRepo: Repository<Mt5Symbol>;

  constructor(private readonly dataSource: DataSource) {
    this.tradeSignal = this.dataSource.getRepository(TradeSignal);
    this.mt5SymbolRepo = this.dataSource.getRepository(Mt5Symbol);
  }

  async ensureSchema() {
    const statements = [
      `
      CREATE TABLE IF NOT EXISTS mt5_symbols (
        id SERIAL PRIMARY KEY,
        broker_account_id TEXT NOT NULL,
        symbol VARCHAR(50) NOT NULL,
        digits INTEGER NULL,
        point NUMERIC(18, 10) NULL,
        tick_size NUMERIC(18, 10) NULL,
        pip_size NUMERIC(18, 10) NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      `,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_mt5_symbols_account_symbol ON mt5_symbols (broker_account_id, symbol);`,
      // Per-account secret key that the EA must send on every request (X-Poll-Key header)
      `ALTER TABLE user_trading_accounts ADD COLUMN IF NOT EXISTS mt5_poll_key TEXT;`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_uta_mt5_poll_key ON user_trading_accounts (mt5_poll_key) WHERE mt5_poll_key IS NOT NULL;`,
    ];

    for (const sql of statements) {
      await this.dataSource.query(sql);
    }
  }

  /**
   * Validates the poll key sent by the EA via X-Poll-Key header.
   * Returns true only if a user_trading_account with matching account_id AND mt5_poll_key exists.
   */
  async findAccountByPollKey(brokerAccountId: string, pollKey: string): Promise<boolean> {
    if (!brokerAccountId || !pollKey || pollKey.length < 16) return false;
    const rows = await this.dataSource.query(
      `SELECT 1 FROM user_trading_accounts WHERE account_id = $1 AND mt5_poll_key = $2 LIMIT 1`,
      [brokerAccountId, pollKey],
    );
    return rows.length > 0;
  }

  /** Store MT5 funds (balance/equity/margin) into account_meta.mt5Funds by account_id. */
  async updateMt5Funds(brokerAccountId: string, funds: Record<string, any>): Promise<void> {
    await this.dataSource.query(
      `UPDATE user_trading_accounts
         SET account_meta = COALESCE(account_meta, '{}'::jsonb) || jsonb_build_object('mt5Funds', $2::jsonb)
       WHERE account_id = $1`,
      [brokerAccountId, JSON.stringify(funds)],
    );
  }

  /** Read MT5 funds for one of the user's accounts (ownership-checked). */
  async getMt5Funds(userId: number, tradingAccountId: number): Promise<Record<string, any> | null> {
    const rows = await this.dataSource.query(
      `SELECT account_meta->'mt5Funds' AS funds
         FROM user_trading_accounts
        WHERE id = $1 AND user_id = $2
        LIMIT 1`,
      [tradingAccountId, userId],
    );
    return rows[0]?.funds ?? null;
  }

  /**
   * Atomically claims the next pending MT5 job for the given account.
   * Uses SELECT FOR UPDATE SKIP LOCKED so concurrent EA polls never double-claim
   * the same job. The status is updated to 'in_progress' (or 'in_progress_close')
   * inside the same transaction before the lock is released.
   */
  async getNextPendingJob(brokerAccountId: string): Promise<TradeSignal | null> {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<Array<{ id: number; status: string }>>(
        `SELECT ts.id, tss.status
         FROM trade_signals ts
         INNER JOIN trade_signals_status tss ON tss.signal_id = ts.id
         INNER JOIN user_trading_accounts uta ON uta.id = ts.trading_account_id
         INNER JOIN brokers b ON b.id = uta.broker_id
         WHERE b.code = 'MT5'
           AND uta.account_id = $1
           AND tss.status IN ('pending', 'pending_close')
         ORDER BY ts.created_at ASC
         LIMIT 1
         FOR UPDATE OF tss SKIP LOCKED`,
        [brokerAccountId],
      );

      if (!rows.length) return null;

      const { id, status } = rows[0];
      const newStatus = status === "pending_close" ? "in_progress_close" : "in_progress";

      await manager.query(
        `UPDATE trade_signals_status SET status = $1 WHERE signal_id = $2`,
        [newStatus, id],
      );

      return manager.findOne(TradeSignal, {
        where: { id },
        relations: ["tradingAccount", "status", "tradingAccount.broker"],
      });
    });
  }

  async getJobBySignalId(signalId: number) {
    if (!Number.isFinite(signalId) || signalId <= 0) return null;

    return this.tradeSignal.findOne({
      where: { id: signalId },
      relations: ["status"],
    });
  }

  /**
   * Resets MT5 jobs stuck in in_progress / in_progress_close for longer than
   * staleAfterSeconds. With a 1-second EA poll interval a job should ACK within
   * ~2-3 seconds; anything beyond 7s means the EA is gone.
   */
  async resetStaleInProgressJobs(staleAfterSeconds = 7): Promise<number> {
    const result = await this.dataSource.query(
      `UPDATE trade_signals_status
       SET status      = CASE WHEN status = 'in_progress_close' THEN 'pending_close' ELSE 'pending' END,
           last_error  = 'reset_stale_in_progress',
           attempts    = attempts + 1
       WHERE signal_id IN (
         SELECT ts.id FROM trade_signals ts
         INNER JOIN user_trading_accounts uta ON uta.id = ts.trading_account_id
         INNER JOIN brokers b ON b.id = uta.broker_id
         WHERE b.code = 'MT5'
       )
       AND status IN ('in_progress', 'in_progress_close')
       AND updated_at < NOW() - make_interval(secs => $1::float)`,
      [staleAfterSeconds],
    );
    return result[1] ?? 0;
  }

  private toBigIntText(value: unknown): string | null {
    if (value === undefined || value === null || value === "") return null;
    const text = String(value).trim();
    if (!/^\d+$/.test(text)) return null;
    try {
      if (BigInt(text) <= 0n) return null;
      return text;
    } catch {
      return null;
    }
  }

  async markJobSuccess(job: TradeSignal, refs?: number | Mt5BrokerRefs) {
    const normalizedRefs: Mt5BrokerRefs =
      typeof refs === "object" && refs !== null ? refs : { orderId: refs };
    const orderId = this.toBigIntText(normalizedRefs.orderId);
    const brokerOrderId = this.toBigIntText(normalizedRefs.brokerOrderId);
    const brokerPositionId = this.toBigIntText(normalizedRefs.brokerPositionId);

    await this.dataSource.transaction(async (manager) => {
      if (orderId || brokerOrderId || brokerPositionId) {
        await manager.query(
          `
          UPDATE trade_signals
          SET order_id=COALESCE($2::bigint, order_id),
              broker_order_id=COALESCE($3::bigint, broker_order_id),
              broker_position_id=COALESCE($4::bigint, broker_position_id)
          WHERE id=$1
          `,
          [job.id, orderId, brokerOrderId, brokerPositionId]
        );
      }

      await manager.query(
        `UPDATE trade_signals_status SET status='completed' WHERE id=$1`,
        [job.status.id]
      );
    });
  }

  async markJobCloseSuccess(job: TradeSignal, refs?: number | Mt5BrokerRefs) {
    const normalizedRefs: Mt5BrokerRefs =
      typeof refs === "object" && refs !== null ? refs : { orderId: refs };
    const orderId = this.toBigIntText(normalizedRefs.orderId);
    const brokerOrderId = this.toBigIntText(normalizedRefs.brokerOrderId);
    const brokerPositionId = this.toBigIntText(normalizedRefs.brokerPositionId);

    await this.dataSource.transaction(async (manager) => {
      if (orderId || brokerOrderId || brokerPositionId) {
        await manager.query(
          `
          UPDATE trade_signals
          SET order_id=COALESCE($2::bigint, order_id),
              broker_order_id=COALESCE($3::bigint, broker_order_id),
              broker_position_id=COALESCE($4::bigint, broker_position_id)
          WHERE id=$1
          `,
          [job.id, orderId, brokerOrderId, brokerPositionId]
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
          attempts=attempts+1,
          last_error=$2,
          next_retry_at=NULL
      WHERE id=$1
      `,
      [job.status.id, String(error ?? "execution_failed")]
    );
  }

  async replaceMt5Symbols(
    brokerAccountId: string,
    items: Array<{
      symbol: string;
      digits?: number | null;
      point?: number | null;
      tickSize?: number | null;
      pipSize?: number | null;
    }>,
  ) {
    const normalizedBrokerAccountId = String(brokerAccountId ?? "").trim();
    if (!normalizedBrokerAccountId) return;

    await this.mt5SymbolRepo.delete({ brokerAccountId: normalizedBrokerAccountId });

    if (!items.length) {
      return;
    }

    await this.mt5SymbolRepo.insert(
      items.map((item) => ({
        brokerAccountId: normalizedBrokerAccountId,
        symbol: String(item.symbol).trim().toUpperCase(),
        digits:
          item.digits === undefined || item.digits === null ? null : Number(item.digits),
        point:
          item.point === undefined || item.point === null ? null : String(item.point),
        tickSize:
          item.tickSize === undefined || item.tickSize === null ? null : String(item.tickSize),
        pipSize:
          item.pipSize === undefined || item.pipSize === null ? null : String(item.pipSize),
      })),
    );
  }

  async getMt5SymbolMeta(brokerAccountId: string, symbol: string) {
    const normalizedBrokerAccountId = String(brokerAccountId ?? "").trim();
    const normalizedSymbol = String(symbol ?? "").trim().toUpperCase();
    if (!normalizedBrokerAccountId || !normalizedSymbol) return null;

    return this.mt5SymbolRepo.findOne({
      where: {
        brokerAccountId: normalizedBrokerAccountId,
        symbol: normalizedSymbol,
      },
    });
  }
}
