import { TradeGuardService } from "../trade/services/tradeGuard.service";
import { Mt5BrokerRefs, Mt5ListenerDBServices } from "./mt5Listener.db";
import { DistanceMappingService } from "../trade/services/distanceMapping.service";

export class Mt5ListenerServices {
  private readonly distanceMappingService = new DistanceMappingService();

  constructor(
    private readonly dbService: Mt5ListenerDBServices
  ) {}

  async ensureSchema() {
    await this.dbService.ensureSchema();
  }

  private toPositiveInt(value: unknown): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.trunc(parsed);
  }

  private toPositiveBrokerRef(value: unknown): string | null {
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

  private toOptionalNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return undefined;
    return parsed;
  }

  private normalizeOrderType(value: unknown): string {
    const raw = String(value ?? "").trim().toUpperCase();
    if (!raw) return "MARKET";
    if (raw === "MKT") return "MARKET";
    if (raw === "LMT") return "LIMIT";
    if (raw === "STP") return "STOP";
    if (raw === "STOPLIMIT") return "STOP_LIMIT";
    if (raw === "MARKETRANGE") return "MARKET_RANGE";
    return raw;
  }

  private firstNonEmptyString(...values: unknown[]): string {
    for (const value of values) {
      const text = String(value ?? "").trim();
      if (text) return text;
    }
    return "";
  }

  private extractAckRefs(ack: any): Mt5BrokerRefs {
    const orderId =
      this.toPositiveBrokerRef(ack?.orderId) ??
      this.toPositiveBrokerRef(ack?.order_id) ??
      this.toPositiveBrokerRef(ack?.ticket);

    const brokerOrderId =
      this.toPositiveBrokerRef(ack?.brokerOrderId) ??
      this.toPositiveBrokerRef(ack?.broker_order_id) ??
      this.toPositiveBrokerRef(ack?.orderId) ??
      this.toPositiveBrokerRef(ack?.order_id);

    const brokerPositionId =
      this.toPositiveBrokerRef(ack?.brokerPositionId) ??
      this.toPositiveBrokerRef(ack?.broker_position_id) ??
      this.toPositiveBrokerRef(ack?.positionTicket) ??
      this.toPositiveBrokerRef(ack?.position_ticket);

    return {
      ...(orderId ? { orderId } : {}),
      ...(brokerOrderId ? { brokerOrderId } : {}),
      ...(brokerPositionId ? { brokerPositionId } : {}),
    };
  }

  async getSignalForEA(brokerAccountId: string) {
    try {
      const job = await this.dbService.getNextPendingJob(
        brokerAccountId
      );
      if (!job) return {};

      // getNextPendingJob already atomically updated status to in_progress / in_progress_close
      const currentStatus = String(job.status?.status ?? "").toLowerCase();
      const isCloseJob = currentStatus === "in_progress_close";

      if (isCloseJob) {
        const brokerPositionId = this.toPositiveBrokerRef(job.brokerPositionId);
        const brokerOrderId = this.toPositiveBrokerRef(job.brokerOrderId);
        const orderId = this.toPositiveBrokerRef(job.orderId);
        const ticket = brokerPositionId ?? brokerOrderId ?? orderId;
        const closePayload: Record<string, unknown> = {
          ackId: job.id,
          executionMode: "CLOSE",
          side: "close",
          symbol: job.symbol,
          ...(brokerOrderId ? { brokerOrderId } : {}),
          ...(brokerPositionId ? { brokerPositionId } : {}),
          ...(orderId ? { orderId } : {}),
        };

        if (ticket) closePayload.ticket = ticket;

        return closePayload;
      }

      if (!(await new TradeGuardService().validateTrade(job.tradingAccount, job)).allowed) return {};

      if (Number(job.volume) <= 0) {
        await this.dbService.markJobFailed(
          job,
          "Invalid volume"
        );
        return {};
      }

      const payload: Record<string, unknown> = {
        ackId: job.id,
        side: String(job.action).toLowerCase(),
        symbol: job.symbol,
        qty: Number(job.volume) || 1,
        executionMode: job.executionMode ?? "OPEN",
        orderType: this.normalizeOrderType(job.orderType),
      };

      if (job.entryRef) payload.entryRef = job.entryRef;

      const limitPrice = this.toOptionalNumber(job.limitPrice);
      const stopPrice = this.toOptionalNumber(job.stopPrice);
      const stopLoss = this.toOptionalNumber(job.stopLoss);
      const takeProfit = this.toOptionalNumber(job.takeProfit);
      if (limitPrice !== undefined) payload.limitPrice = limitPrice;
      if (stopPrice !== undefined) payload.stopPrice = stopPrice;
      if (stopLoss !== undefined) payload.stopLoss = stopLoss;
      if (takeProfit !== undefined) payload.takeProfit = takeProfit;

      try {
        const stopLossDistance = this.toOptionalNumber(job.stopLossDistance);
        const takeProfitDistance = this.toOptionalNumber(job.takeProfitDistance);
        const needsDistanceMapping =
          stopLossDistance !== undefined || takeProfitDistance !== undefined;
        const symbolMeta = needsDistanceMapping
          ? await this.dbService.getMt5SymbolMeta(brokerAccountId, String(job.symbol ?? ""))
          : null;

        if (stopLossDistance !== undefined) {
          payload.stopLossDistance = this.distanceMappingService.resolve({
            broker: "MT5",
            symbol: String(job.symbol ?? ""),
            requestedDistance: stopLossDistance,
            mt5Meta: symbolMeta
              ? {
                  digits: symbolMeta.digits,
                  point: symbolMeta.point,
                  tickSize: symbolMeta.tickSize,
                  pipSize: symbolMeta.pipSize,
                }
              : null,
          }).priceDistance;
        }

        if (takeProfitDistance !== undefined) {
          payload.takeProfitDistance = this.distanceMappingService.resolve({
            broker: "MT5",
            symbol: String(job.symbol ?? ""),
            requestedDistance: takeProfitDistance,
            mt5Meta: symbolMeta
              ? {
                  digits: symbolMeta.digits,
                  point: symbolMeta.point,
                  tickSize: symbolMeta.tickSize,
                  pipSize: symbolMeta.pipSize,
                }
              : null,
          }).priceDistance;
        }
      } catch (error) {
        await this.dbService.markJobFailed(
          job,
          error instanceof Error ? error.message : String(error),
        );
        return {};
      }

      return payload;
    } catch (error) {
      throw error;
    }
  }

  async handleState(brokerAccountId: string, payload: any) {
    const normalizedBrokerAccountId = this.firstNonEmptyString(
      brokerAccountId,
      payload?.brokerAccountId,
      payload?.userId,
      payload?.account_login,
      payload?.accountLogin,
    );

    if (!normalizedBrokerAccountId) {
      return { ok: false, error: "broker_account_id_required" };
    }

    const hasSymbolItems =
      Array.isArray(payload?.items) ||
      Array.isArray(payload?.symbolSpecs) ||
      Array.isArray(payload?.symbols);

    if (!hasSymbolItems) {
      return {
        ok: true,
        brokerAccountId: normalizedBrokerAccountId,
        count: 0,
        symbolsUpdated: false,
      };
    }

    const itemsRaw = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.symbolSpecs)
        ? payload.symbolSpecs
        : Array.isArray(payload?.symbols)
          ? payload.symbols
          : [];

    const items: Array<{
      symbol: string;
      digits: number | null;
      point: number | null;
      tickSize: number | null;
      pipSize: number | null;
    }> = itemsRaw
      .map((item: any) => ({
        symbol: String(item?.symbol ?? item?.name ?? "").trim().toUpperCase(),
        digits:
          item?.digits === undefined || item?.digits === null ? null : Number(item.digits),
        point:
          item?.point === undefined || item?.point === null ? null : Number(item.point),
        tickSize:
          item?.tickSize === undefined || item?.tickSize === null
            ? item?.tick_size === undefined || item?.tick_size === null
              ? null
              : Number(item.tick_size)
            : Number(item.tickSize),
        pipSize:
          item?.pipSize === undefined || item?.pipSize === null
            ? item?.pip_size === undefined || item?.pip_size === null
              ? null
              : Number(item.pip_size)
            : Number(item.pipSize),
      }))
      .filter((item: { symbol: string }) => Boolean(item.symbol));

    await this.dbService.replaceMt5Symbols(normalizedBrokerAccountId, items);

    // Persist account funds (MT5 has no REST API — balance/equity arrive via EA state sync).
    const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null);
    const funds = {
      balance: num(payload?.account_balance ?? payload?.balance),
      equity: num(payload?.account_equity ?? payload?.equity),
      margin: num(payload?.account_margin ?? payload?.margin),
      freeMargin: num(payload?.account_free_margin ?? payload?.free_margin ?? payload?.freeMargin),
      currency: this.firstNonEmptyString(payload?.account_currency, payload?.currency) || null,
      updatedAt: new Date().toISOString(),
    };
    if (funds.balance !== null || funds.equity !== null) {
      await this.dbService.updateMt5Funds(normalizedBrokerAccountId, funds).catch(() => {});
    }

    return {
      ok: true,
      brokerAccountId: normalizedBrokerAccountId,
      count: items.length,
    };
  }

  /** Read stored MT5 funds for one of the user's accounts (from account_meta). */
  async getFunds(userId: number, tradingAccountId: number) {
    const f = await this.dbService.getMt5Funds(userId, tradingAccountId);
    if (!f) {
      throw { statusCode: 404, message: "mt5_funds_unavailable" };
    }
    const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    return {
      ok: true,
      availableCash: num(f.freeMargin ?? f.balance),
      marginUsed: num(f.margin),
      collateral: 0,
      totalFunds: num(f.equity ?? f.balance),
      currency: f.currency ?? "USD",
      raw: f,
    };
  }

  async handleAck(ack: any) {
    const ackId = this.toPositiveInt(ack?.ackId);
    if (!ackId) return;

    const job = await this.dbService.getJobBySignalId(ackId);
    if (!job?.status?.id) return;

    const status = String(ack?.status ?? "").toLowerCase();
    const message = String(ack?.message ?? "unknown");
    const refs = this.extractAckRefs(ack);

    const signalStatus = String(job.status.status ?? "").toLowerCase();
    const ackExecutionMode = String(ack?.executionMode ?? ack?.execution_mode ?? "")
      .trim()
      .toUpperCase();
    const ackSide = String(ack?.side ?? "").trim().toLowerCase();
    const isCloseJob =
      signalStatus === "pending_close" ||
      signalStatus === "in_progress_close" ||
      signalStatus === "closed" ||
      ackExecutionMode === "CLOSE" ||
      ackSide === "close" ||
      ackSide === "exit";

    if (status === "success") {
      if (isCloseJob) {
        await this.dbService.markJobCloseSuccess(
          job,
          refs
        );
        return;
      }

      await this.dbService.markJobSuccess(
        job,
        refs
      );
      return;
    }

    if (status === "skipped" && isCloseJob) {
      await this.dbService.markJobCloseSuccess(
        job,
        refs
      );
      return;
    }

    await this.dbService.markJobFailed(
      job,
      message
    );
  }
}
