import { In, Repository } from "typeorm";
import { TradeSignal } from "../../../entity/TradeSignals";
import { TradeSignalStatus } from "../../../entity/TradeSignalsStatus";
import { UserTradingAccount } from "../../../entity/UserTradingAccount";
import { CTraderSymbol } from "../../../entity/CTraderSymbol";
import AppDataSource from "../../../db/data-source";
import { ClaimedSignal } from "../../../db/enums";

export class CTradeSignalDB {
  private tradeSignalRepo: Repository<TradeSignal>;
  private tradeSignalStatusRepo: Repository<TradeSignalStatus>;
  private tradingAccountRepo: Repository<UserTradingAccount>;
  private cTraderSymbolRepo: Repository<CTraderSymbol>;
  constructor() {
    this.tradeSignalRepo = AppDataSource.getRepository(TradeSignal);
    this.tradeSignalStatusRepo = AppDataSource.getRepository(TradeSignalStatus);
    this.tradingAccountRepo = AppDataSource.getRepository(UserTradingAccount);
    this.cTraderSymbolRepo = AppDataSource.getRepository(CTraderSymbol);
  }

  async ensureSchema() {
    const statements = [
      `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS execution_mode VARCHAR(20);`,
      `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS entry_ref VARCHAR(100);`,
      `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS order_type VARCHAR(20);`,
      `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS limit_price NUMERIC(15, 6);`,
      `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS stop_price NUMERIC(15, 6);`,
      `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS stop_loss NUMERIC(15, 6);`,
      `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS take_profit NUMERIC(15, 6);`,
      `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS stop_loss_distance NUMERIC(15, 6);`,
      `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS take_profit_distance NUMERIC(15, 6);`,
      `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS stop_loss_amount NUMERIC(15, 6);`,
      `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS take_profit_amount NUMERIC(15, 6);`,
      `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS trailing_stop_loss BOOLEAN;`,
      `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS guaranteed_stop_loss BOOLEAN;`,
      `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS stop_loss_trigger_method VARCHAR(30);`,
      `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS trailing_take_profit_activation_distance NUMERIC(15, 6);`,
      `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS trailing_take_profit_distance NUMERIC(15, 6);`,
      `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS break_even_activation_distance NUMERIC(15, 6);`,
      `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS break_even_offset_distance NUMERIC(15, 6);`,
      `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS trailing_stop_loss_distance NUMERIC(15, 6);`,
      `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS broker_order_id BIGINT;`,
      `ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS broker_position_id BIGINT;`,
      `ALTER TABLE trade_signals_status ADD COLUMN IF NOT EXISTS last_error TEXT;`,
      `ALTER TABLE trade_signals_status ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;`,
      `ALTER TABLE ctrader_symbols ADD COLUMN IF NOT EXISTS lot_size BIGINT;`,
      `ALTER TABLE ctrader_symbols ADD COLUMN IF NOT EXISTS digits INTEGER;`,
      `ALTER TABLE ctrader_symbols ADD COLUMN IF NOT EXISTS pip_position INTEGER;`,
      `ALTER TABLE ctrader_symbols ADD COLUMN IF NOT EXISTS sl_distance INTEGER;`,
      `ALTER TABLE ctrader_symbols ADD COLUMN IF NOT EXISTS tp_distance INTEGER;`,
      `ALTER TABLE ctrader_symbols ADD COLUMN IF NOT EXISTS distance_set_in VARCHAR(40);`,
      `CREATE INDEX IF NOT EXISTS idx_trade_signals_status_status_next_retry_at ON trade_signals_status (status, next_retry_at);`,
      `CREATE INDEX IF NOT EXISTS idx_trade_signals_trading_account_entry_ref_created_at ON trade_signals (trading_account_id, entry_ref, created_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_trade_signals_entry_ref_execution_mode ON trade_signals (entry_ref, execution_mode);`,
      `
      CREATE TABLE IF NOT EXISTS ctrader_trailing_take_profit_monitors (
        id SERIAL PRIMARY KEY,
        trade_signal_id BIGINT NOT NULL UNIQUE REFERENCES trade_signals(id) ON DELETE CASCADE,
        user_id BIGINT NOT NULL,
        trading_account_id BIGINT NOT NULL REFERENCES user_trading_accounts(id) ON DELETE CASCADE,
        account_id BIGINT NOT NULL,
        env VARCHAR(10) NOT NULL,
        symbol VARCHAR(50) NOT NULL,
        side VARCHAR(10) NOT NULL,
        entry_ref VARCHAR(100) NOT NULL,
        symbol_id INTEGER NULL,
        broker_order_id BIGINT NULL,
        broker_position_id BIGINT NULL,
        entry_price NUMERIC(15, 6) NULL,
        trailing_take_profit_activation_distance NUMERIC(15, 6) NULL,
        trailing_take_profit_distance NUMERIC(15, 6) NULL,
        best_price NUMERIC(15, 6) NULL,
        armed BOOLEAN NOT NULL DEFAULT false,
        break_even_activation_distance NUMERIC(15, 6) NULL,
        break_even_offset_distance NUMERIC(15, 6) NULL,
        trailing_stop_loss_distance NUMERIC(15, 6) NULL,
        stop_loss_protection_armed BOOLEAN NOT NULL DEFAULT false,
        stop_loss_best_price NUMERIC(15, 6) NULL,
        current_stop_loss NUMERIC(15, 6) NULL,
        monitor_status VARCHAR(20) NOT NULL DEFAULT 'pending_fill',
        last_error TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      `,
      `ALTER TABLE ctrader_trailing_take_profit_monitors ALTER COLUMN trailing_take_profit_activation_distance DROP NOT NULL;`,
      `ALTER TABLE ctrader_trailing_take_profit_monitors ALTER COLUMN trailing_take_profit_distance DROP NOT NULL;`,
      `ALTER TABLE ctrader_trailing_take_profit_monitors ADD COLUMN IF NOT EXISTS break_even_activation_distance NUMERIC(15, 6);`,
      `ALTER TABLE ctrader_trailing_take_profit_monitors ADD COLUMN IF NOT EXISTS break_even_offset_distance NUMERIC(15, 6);`,
      `ALTER TABLE ctrader_trailing_take_profit_monitors ADD COLUMN IF NOT EXISTS trailing_stop_loss_distance NUMERIC(15, 6);`,
      `ALTER TABLE ctrader_trailing_take_profit_monitors ADD COLUMN IF NOT EXISTS stop_loss_protection_armed BOOLEAN NOT NULL DEFAULT false;`,
      `ALTER TABLE ctrader_trailing_take_profit_monitors ADD COLUMN IF NOT EXISTS stop_loss_best_price NUMERIC(15, 6);`,
      `ALTER TABLE ctrader_trailing_take_profit_monitors ADD COLUMN IF NOT EXISTS current_stop_loss NUMERIC(15, 6);`,
      `CREATE INDEX IF NOT EXISTS idx_ctrader_ttp_monitors_status_updated_at ON ctrader_trailing_take_profit_monitors (monitor_status, updated_at DESC);`,
    ];

    for (const sql of statements) {
      await AppDataSource.query(sql);
    }
  }

  async getPendingSignalDetailsForCTrader(): Promise<TradeSignal[]> {
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
    } catch (error) {
      throw error;
    }
  }

  async markJobInProgress(job: TradeSignal) {
    await this.tradeSignalRepo.manager.query(
      `UPDATE trade_signals_status SET status='in_progress' WHERE id=$1`,
      [job.status.id]
    );
  }

  async markJobSuccess(job: TradeSignal) {
    await this.tradeSignalRepo.manager.query(
      `UPDATE trade_signals_status SET status='completed', last_error=NULL, next_retry_at=NULL WHERE id=$1`,
      [job.status.id]
    );
  }

  async markJobCloseSuccess(job: TradeSignal) {
    await this.tradeSignalRepo.manager.query(
      `UPDATE trade_signals_status SET status='closed', last_error=NULL, next_retry_at=NULL WHERE id=$1`,
      [job.status.id]
    );
  }

  async markJobFailed(job: TradeSignal, error: string) {
    await this.tradeSignalRepo.manager.query(
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

  private computeRetryAt(currentAttempts: number, retryBaseDelayMs: number): Date {
    const safeAttempts = Number.isFinite(currentAttempts) ? currentAttempts : 0;
    const baseDelay = Math.max(250, Number.isFinite(retryBaseDelayMs) ? retryBaseDelayMs : 1000);
    const delayMs = Math.min(5 * 60 * 1000, baseDelay * Math.pow(2, Math.max(0, safeAttempts)));
    return new Date(Date.now() + delayMs);
  }

  async scheduleJobRetry(
    job: TradeSignal,
    nextStatus: "pending" | "pending_close",
    error: string,
    maxRetryAttempts: number,
    retryBaseDelayMs: number,
  ) {
    const nextAttempts = Number(job.status?.attempts ?? 0) + 1;
    const cappedMaxAttempts = Math.max(1, Number.isFinite(maxRetryAttempts) ? maxRetryAttempts : 5);

    if (nextAttempts >= cappedMaxAttempts) {
      await this.markJobFailed(job, error);
      return;
    }

    const nextRetryAt = this.computeRetryAt(Number(job.status?.attempts ?? 0), retryBaseDelayMs);
    await this.tradeSignalRepo.manager.query(
      `
      UPDATE trade_signals_status
      SET status=$2,
          attempts=attempts+1,
          last_error=$3,
          next_retry_at=$4
      WHERE id=$1
      `,
      [job.status.id, nextStatus, String(error ?? "execution_retry_scheduled"), nextRetryAt]
    );
  }

  async updateTradingAccountTokens(
    tradingAccountId: number,
    accessToken: string,
    refreshToken?: string,
  ): Promise<void> {
    const access = String(accessToken ?? "").trim();
    if (!Number.isFinite(tradingAccountId) || tradingAccountId <= 0 || !access) return;

    const patch: any = {
      accessToken: access,
    };
    const refresh = String(refreshToken ?? "").trim();
    if (refresh) patch.refreshToken = refresh;

    await this.tradingAccountRepo.update({ id: tradingAccountId }, patch);
  }

  /** Load a user's cTrader account with tokens/accountId/env for a funds read. */
  async getAccountForFunds(userId: number, tradingAccountId: number) {
    const acc = await this.tradingAccountRepo.findOne({
      where: { id: tradingAccountId, userId } as any,
    });
    if (!acc) return null;
    const env = String((acc as any)?.accountMeta?.env ?? "demo").trim().toLowerCase();
    return {
      tradingAccountId: acc.id,
      gatewayUserId: String(acc.userId),
      accountId: Number(acc.accountId),
      env: (env === "live" ? "live" : "demo") as "demo" | "live",
      accessToken: String((acc as any).accessToken ?? "").trim(),
      refreshToken: String((acc as any).refreshToken ?? "").trim() || undefined,
    };
  }

  async updateTradingAccountAccountId(tradingAccountId: number, accountId: number): Promise<void> {
    if (
      !Number.isFinite(tradingAccountId) ||
      tradingAccountId <= 0 ||
      !Number.isFinite(accountId) ||
      accountId <= 0
    ) {
      return;
    }

    await this.tradingAccountRepo.update({ id: tradingAccountId }, { accountId: String(accountId) });
  }

  async getCTraderSymbolMeta(
    userId: string | number,
    env: "demo" | "live",
    accountId: number,
    symbol: string,
  ): Promise<Pick<CTraderSymbol, "pipPosition" | "digits" | "symbolId" | "symbolName"> | null> {
    const normalizedUserId = String(userId ?? "").trim();
    const normalizedSymbol = String(symbol ?? "").trim().toUpperCase();
    if (!normalizedUserId || !normalizedSymbol || !Number.isFinite(accountId) || accountId <= 0) {
      return null;
    }

    return await this.cTraderSymbolRepo.findOne({
      select: {
        symbolId: true,
        symbolName: true,
        digits: true,
        pipPosition: true,
      },
      where: {
        userId: normalizedUserId,
        env,
        accountId,
        symbolName: normalizedSymbol,
      },
    });
  }

  async getAllTradeTo({ start, count }: { start: number; count: number }) {
    const data: TradeSignal[] = await this.tradeSignalRepo
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

  async claimPendingTrades(limit: number): Promise<ClaimedSignal[]> {
    const qr = AppDataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const statusRepo = qr.manager.getRepository(TradeSignalStatus);

      const qb: any = statusRepo
        .createQueryBuilder("s")
        .leftJoinAndSelect("s.tradeSignal", "ts")
        .leftJoinAndSelect("ts.tradingAccount", "ta")
        .leftJoinAndSelect("ta.broker", "b")
        .select("s.tradeSignalId", "id")
        .where("s.status = :status", { status: "pending" })
        .andWhere("b.code = :code", { code: "CT" })
        .andWhere("(s.nextRetryAt IS NULL OR s.nextRetryAt <= NOW())")
        .orderBy("s.tradeSignalId", "ASC")
        .limit(limit)
        .setLock("pessimistic_write");

      if (typeof qb.setOnLocked === "function") qb.setOnLocked("skip_locked");

      const rows: Array<{ id: any }> = await qb.getRawMany();
      const ids = rows.map((r) => Number(r.id)).filter(Boolean);

      if (!ids.length) {
        await qr.commitTransaction();
        return [];
      }

      await statusRepo
        .createQueryBuilder()
        .update(TradeSignalStatus)
        .set({ status: "in_progress", updatedAt: new Date() })
        .where("tradeSignalId IN (:...ids)", { ids })
        .execute();

      // Fetch signals
      const signals = await qr.manager
        .getRepository(TradeSignal)
        .createQueryBuilder("ts")
        .leftJoinAndSelect("ts.tradingAccount", "ta")
        .leftJoinAndSelect("ta.broker", "b")
        .where("ts.id IN (:...ids)", { ids })
        .andWhere("(b.code = :code OR b.name = :name)", { code: "CT", name: "CTrader" })
        .getMany();

      // keep order as ids
      const map = new Map(signals.map((s) => [s.id, s]));
      const ordered = ids.map((id) => map.get(id)).filter(Boolean) as TradeSignal[];
      const badIds: number[] = [];
      const structured: ClaimedSignal[] = [];

      for (const s of ordered) {
        const userId = s?.userId;
        const tradingAccountId = Number(s?.tradingAccount?.id ?? s?.tradingAccountId);
        const accountId = Number(s?.tradingAccount?.accountId);
        const env = String((s?.tradingAccount as any)?.accountMeta?.env ?? "").trim().toLowerCase();
        const accessToken = String(s?.tradingAccount?.accessToken ?? "").trim();
        const refreshToken = String(s?.tradingAccount?.refreshToken ?? "").trim();

        if (
          !userId ||
          !Number.isFinite(Number(userId)) ||
          !Number.isFinite(tradingAccountId) ||
          tradingAccountId <= 0 ||
          !Number.isFinite(accountId) ||
          accountId <= 0 ||
          !accessToken
        ) {
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
          volume: s.volume ?? null,
          exchange: String(s.exchange),
          assetType: String(s.assetType),
          signalTime: s.signalTime instanceof Date ? s.signalTime.toISOString() : new Date(s.signalTime as any).toISOString(),
          userId: Number(userId),
          executionMode:
            s.executionMode === "OPEN" || s.executionMode === "AMEND_SLTP"
              ? s.executionMode
              : null,
          entryRef: s.entryRef ?? null,
          orderType: s.orderType ?? null,
          limitPrice: s.limitPrice ?? null,
          stopPrice: s.stopPrice ?? null,
          stopLoss: s.stopLoss ?? null,
          takeProfit: s.takeProfit ?? null,
          stopLossDistance: s.stopLossDistance ?? null,
          takeProfitDistance: s.takeProfitDistance ?? null,
          stopLossAmount: s.stopLossAmount ?? null,
          takeProfitAmount: s.takeProfitAmount ?? null,
          trailingStopLoss: s.trailingStopLoss ?? null,
          guaranteedStopLoss: s.guaranteedStopLoss ?? null,
          stopLossTriggerMethod: s.stopLossTriggerMethod ?? null,
          trailingTakeProfitActivationDistance:
            s.trailingTakeProfitActivationDistance ?? null,
          trailingTakeProfitDistance: s.trailingTakeProfitDistance ?? null,
          breakEvenActivationDistance: s.breakEvenActivationDistance ?? null,
          breakEvenOffsetDistance: s.breakEvenOffsetDistance ?? null,
          trailingStopLossDistance: s.trailingStopLossDistance ?? null,
          brokerOrderId: s.brokerOrderId ?? null,
          brokerPositionId: s.brokerPositionId ?? null,
        });
      }

      // Any bad ones -> set status failed so they don’t keep getting re-claimed forever
      if (badIds.length) {
        await qr.manager.query(
          `
          UPDATE trade_signals_status
          SET status='failed',
              attempts=attempts+1,
              last_error='invalid_claimed_trade_signal_data',
              next_retry_at=NULL,
              updated_at=NOW()
          WHERE signal_id = ANY($1::int[])
          `,
          [badIds]
        );
      }
      await qr.commitTransaction();
      return structured;
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  async updateTradeStatus(
    data: {
      id: number;
      status: string;
      error?: string;
      orderId?: string | number;
      brokerOrderId?: string | number;
      brokerPositionId?: string | number;
      maxRetryAttempts?: number;
      retryBaseDelayMs?: number;
    }[]
  ) {
    const ids = data.map((d) => d.id).filter(Boolean);
    if (!ids.length) return;

    const jobs = await this.tradeSignalRepo.find({
      where: { id: In(ids) },
      relations: ["status"],
    });

    const jobMap = new Map(jobs.map((j) => [j.id, j]));

    await Promise.all(
      data.map(async (item) => {
        const job = jobMap.get(item.id);
        if (!job?.status?.id) return;

        const status = String(item.status ?? "").toLowerCase();

        if (status === "in_progress" || status === "processing") {
          await this.markJobInProgress(job);
          return;
        }

        if (status === "completed" || status === "success" || status === "executed") {
          if (item.orderId !== undefined) {
            job.orderId = Number(item.orderId);
          }
          if (item.brokerOrderId !== undefined) {
            job.brokerOrderId =
              item.brokerOrderId === null ? null : String(item.brokerOrderId);
          }
          if (item.brokerPositionId !== undefined) {
            job.brokerPositionId =
              item.brokerPositionId === null ? null : String(item.brokerPositionId);
          }
          await this.tradeSignalRepo.save(job);
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

        if (status === "retry_pending" || status === "retry_pending_close") {
          await this.scheduleJobRetry(
            job,
            status === "retry_pending_close" ? "pending_close" : "pending",
            item.error ?? "execution_retry_scheduled",
            Number(item.maxRetryAttempts ?? 5),
            Number(item.retryBaseDelayMs ?? 1000),
          );
          return;
        }

        await this.tradeSignalStatusRepo
          .createQueryBuilder()
          .update(TradeSignalStatus)
          .set({ status: item.status, updatedAt: new Date() })
          .where("tradeSignalId = :id", { id: item.id })
          .execute();
      })
    );
  }

  async claimPendingCloseTrades(limit: number): Promise<any[]> {
    const qr = AppDataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const statusRepo = qr.manager.getRepository(TradeSignalStatus);

      const qb: any = statusRepo
        .createQueryBuilder("s")
        .leftJoinAndSelect("s.tradeSignal", "ts")
        .leftJoinAndSelect("ts.tradingAccount", "ta")
        .leftJoinAndSelect("ta.broker", "b")
        .select("s.tradeSignalId", "id")
        .where("s.status = :status", { status: "pending_close" })
        .andWhere("b.code = :code", { code: "CT" })
        .andWhere("(s.nextRetryAt IS NULL OR s.nextRetryAt <= NOW())")
        .orderBy("s.tradeSignalId", "ASC")
        .limit(limit)
        .setLock("pessimistic_write");

      if (typeof qb.setOnLocked === "function") qb.setOnLocked("skip_locked");

      const rows: Array<{ id: any }> = await qb.getRawMany();
      //console.log("Claiming pending close trades", { rows });
      const ids = rows.map((r) => Number(r.id)).filter(Boolean);

      if (!ids.length) {
        await qr.commitTransaction();
        return [];
      }

      await statusRepo
        .createQueryBuilder()
        .update(TradeSignalStatus)
        .set({ status: "in_progress", updatedAt: new Date() })
        .where("tradeSignalId IN (:...ids)", { ids })
        .execute();

      // Fetch signals with orderId
      const signals = await qr.manager
        .getRepository(TradeSignal)
        .createQueryBuilder("ts")
        .leftJoinAndSelect("ts.tradingAccount", "ta")
        .leftJoinAndSelect("ta.broker", "b")
        .where("ts.id IN (:...ids)", { ids })
        .andWhere("(b.code = :code OR b.name = :name)", { code: "CT", name: "CTrader" })
        .getMany();

      // Keep order as ids
      const map = new Map(signals.map((s) => [s.id, s]));
      const ordered = ids.map((id) => map.get(id)).filter(Boolean) as TradeSignal[];

      const badIds: number[] = [];
      const structured: any[] = [];

      for (const s of ordered) {
        const userId = Number(s?.userId);
        const orderId = s?.brokerPositionId ?? s?.brokerOrderId ?? s?.orderId;
        const tradingAccountId = Number(s?.tradingAccount?.id ?? s?.tradingAccountId);
        const accountId = Number(s?.tradingAccount?.accountId);
        const env = String((s?.tradingAccount as any)?.accountMeta?.env ?? "").trim().toLowerCase();
        const accessToken = String(s?.tradingAccount?.accessToken ?? "").trim();
        const refreshToken = String(s?.tradingAccount?.refreshToken ?? "").trim();

        if (
          !Number.isFinite(userId) ||
          userId <= 0 ||
          !orderId ||
          !Number.isFinite(Number(orderId)) ||
          !Number.isFinite(tradingAccountId) ||
          tradingAccountId <= 0 ||
          !Number.isFinite(accountId) ||
          accountId <= 0 ||
          !accessToken
        ) {
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
        await qr.manager.query(
          `
          UPDATE trade_signals_status
          SET status='failed',
              attempts=attempts+1,
              last_error='invalid_claimed_close_signal_data',
              next_retry_at=NULL,
              updated_at=NOW()
          WHERE signal_id = ANY($1::int[])
          `,
          [badIds]
        );
      }

      await qr.commitTransaction();
      return structured;
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  async findLatestOpenSignalByEntryRef(tradingAccountId: number, entryRef: string, excludeSignalId?: number) {
    if (!Number.isFinite(tradingAccountId) || tradingAccountId <= 0 || !String(entryRef ?? "").trim()) {
      return null;
    }

    let qb = this.tradeSignalRepo
      .createQueryBuilder("ts")
      .leftJoinAndSelect("ts.status", "tss")
      .where("ts.tradingAccountId = :tradingAccountId", { tradingAccountId })
      .andWhere("ts.entryRef = :entryRef", { entryRef: String(entryRef).trim() })
      .andWhere("ts.executionMode = :executionMode", { executionMode: "OPEN" })
      .andWhere("tss.status IN (:...statuses)", {
        statuses: ["completed", "closed", "pending_close", "in_progress"],
      })
      .orderBy("ts.createdAt", "DESC");

    if (excludeSignalId && Number.isFinite(excludeSignalId)) {
      qb = qb.andWhere("ts.id != :excludeSignalId", { excludeSignalId });
    }

    return qb.getOne();
  }

  async markSignalClosedById(tradeSignalId: number): Promise<void> {
    if (!Number.isFinite(tradeSignalId) || tradeSignalId <= 0) return;
    await this.tradeSignalStatusRepo
      .createQueryBuilder()
      .update(TradeSignalStatus)
      .set({ status: "closed", updatedAt: new Date() })
      .where("tradeSignalId = :tradeSignalId", { tradeSignalId })
      .execute();
  }
}
