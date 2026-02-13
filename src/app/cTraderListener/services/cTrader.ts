import { QueryRunner } from "typeorm";
import { ICreateTradeSignal } from "../../broker/brokerSignals/interfaces/tradeSignal.interface";
import { CTradeSignalDB } from "./cTrader.db";
import { OAuthExchangeResult } from "../../../db/enums";
import AppDataSource from "../../../db/data-source";
import { UserTradingAccount } from "../../../entity/UserTradingAccount";
import { TradingAccountStatus } from "../../subscriptionPlan/enums/subscriberPlan.enum";

type HealthCheckResult = {
  ok: boolean;
  url: string;
  status?: number;
  latencyMs: number;
  payload?: any;
  error?: string;
};

type ExecResult = {
  ok: boolean;
  status?: number;
  payload?: any;
  error?: string;
};

type CompleteOAuthResult =
  | { ok: true; userId: number; rowId: number; ctraderAccountId: string;  }
  | { ok: false; status: number; error: string; details?: any };


export class CTraderService {
  private baseUrl: string;
  private timeoutMs: number;
  private db: CTradeSignalDB;

  private lastHealthAt = 0;
  private lastHealth: HealthCheckResult | null = null;

  constructor(opts?: { baseUrl?: string; timeoutMs?: number }) {
    this.baseUrl = (opts?.baseUrl ?? process.env.CTRADER_GATEWAY_URL ?? "http://69.62.126.107:8089").replace(/\/+$/, "");
    this.timeoutMs = opts?.timeoutMs ?? Number(process.env.CTRADER_HEALTH_TIMEOUT_MS ?? 5000);
    this.db = new CTradeSignalDB();
  }

  async checkConnection(): Promise<HealthCheckResult> {
    const url = `${this.baseUrl}/health`;
    const started = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: controller.signal,
      });

      const latencyMs = Date.now() - started;

      let payload: any = null;
      const contentType = res.headers.get("content-type") ?? "";
      try {
        payload = contentType.includes("application/json") ? await res.json() : await res.text();
      } catch {}

      const ok =
        res.ok &&
        (payload == null ||
          payload === "ok" ||
          payload?.ok === true ||
          payload?.status === "ok" ||
          payload?.healthy === true);

      return {
        ok,
        url,
        status: res.status,
        latencyMs,
        payload,
        ...(ok ? {} : { error: `unhealthy_response status=${res.status}` }),
      };
    } catch (err: any) {
      const latencyMs = Date.now() - started;
      const isAbort = err?.name === "AbortError" || String(err?.message || "").toLowerCase().includes("aborted");
      return {
        ok: false,
        url,
        latencyMs,
        error: isAbort ? `timeout_after_${this.timeoutMs}ms` : (err?.message ?? String(err)),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async isHealthy(ttlMs = 5000): Promise<boolean> {
    const now = Date.now();
    if (this.lastHealth && now - this.lastHealthAt < ttlMs) return this.lastHealth.ok;

    const h = await this.checkConnection();
    this.lastHealth = h;
    this.lastHealthAt = now;
    return h.ok;
  }

  async makeCall({ start, count }: { start: number; count: number }) {
    return this.db.getAllTradeTo({ start, count });
  }

async exectuteTradeSignalApiCall(data: any): Promise<ExecResult> {
  const execPath = process.env.CTRADER_EXEC_PATH ?? "/trade";
  const url = `${this.baseUrl}${execPath}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

  const normalizeSide = (v: any): "BUY" | "SELL" | null => {
    const s = String(v ?? "").trim().toUpperCase();
    if (s === "BUY" || s === "B") return "BUY";
    if (s === "SELL" || s === "S") return "SELL";
    if (s === "LONG") return "BUY";
    if (s === "SHORT") return "SELL";
    return null;
  };

  const normalizeOrderType = (v: any): string => {
    const s = String(v ?? "").trim().toUpperCase();
    if (s === "MARKET" || s === "MKT") return "MARKET";
    if (s === "LIMIT") return "LIMIT";
    if (s === "STOP") return "STOP";
    if (s === "STOP_LIMIT" || s === "STOPLIMIT") return "STOP_LIMIT";
    if (s === "MARKET_RANGE" || s === "MARKETRANGE") return "MARKET_RANGE";
    // default
    return "MARKET";
  };

  try {
    const userId = String(
      data?.userId ?? data?.user_id ?? data?.brokerJob?.userId ?? "",
    ).trim();
    if (!userId) return { ok: false, error: "missing_userId_in_signal_data" };

    const symbol = String(data?.symbol ?? "").trim();
    if (!symbol) return { ok: false, error: "missing_symbol_in_signal_data" };

    const side =
      normalizeSide(data?.side ?? data?.action ?? data?.signalSide) ??
      normalizeSide(String(data?.action ?? "").toLowerCase() === "buy" ? "BUY" : String(data?.action ?? "").toLowerCase() === "sell" ? "SELL" : data?.action);
    if (!side) return { ok: false, error: "invalid_side_expected_buy_or_sell" };

    const orderType = normalizeOrderType(data?.orderType);

    const volumeUnits = Number(data?.volumeUnits ?? data?.qty ?? data?.lots ?? 1000);
    if (!Number.isFinite(volumeUnits) || volumeUnits <= 0) {
      return { ok: false, error: "invalid_volumeUnits" };
    }

    const accountId =
      data?.accountId !== undefined && data?.accountId !== null
        ? Number(data.accountId)
        : undefined;

    const limitPrice = data?.limitPrice !== undefined ? Number(data.limitPrice) : undefined;
    const stopPrice = data?.stopPrice !== undefined ? Number(data.stopPrice) : undefined;

    const stopLoss = data?.stopLoss !== undefined ? Number(data.stopLoss) : undefined;
    const takeProfit = data?.takeProfit !== undefined ? Number(data.takeProfit) : undefined;

    const stopLossDistance =
      data?.stopLossDistance !== undefined ? Number(data.stopLossDistance) : undefined;
    const takeProfitDistance =
      data?.takeProfitDistance !== undefined ? Number(data.takeProfitDistance) : undefined;

    const comment =
      String(data?.comment ?? "").trim() ||
      `tradeSignalId=${data?.id ?? data?.tradeSignalId ?? ""} jobId=${data?.jobId ?? data?.brokerJob?.id ?? ""}`.trim();

    const label = String(data?.label ?? "").trim() || "signal-exec";

    const payload: any = {
      userId,
      symbol,
      side,       // ✅ BUY/SELL
      orderType,  // ✅ MARKET/LIMIT/...
      volumeUnits,

      ...(accountId !== undefined ? { accountId } : {accountId: 46021074}),
      ...(limitPrice !== undefined ? { limitPrice } : {}),
      ...(stopPrice !== undefined ? { stopPrice } : {}),
      ...(stopLoss !== undefined ? { stopLoss } : {}),
      ...(takeProfit !== undefined ? { takeProfit } : {}),
      ...(stopLossDistance !== undefined ? { stopLossDistance } : {}),
      ...(takeProfitDistance !== undefined ? { takeProfitDistance } : {}),
      ...(comment ? { comment } : {}),
      ...(label ? { label } : {}),
    };

    console.log("[CTRADER] Executing trade signal:", payload);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-user-id": userId,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    console.log("[CTRADER] Trade signal executed, response status:", res);

    let body: any = null;
    const ct = res.headers.get("content-type") ?? "";
    try {
      body = ct.includes("application/json") ? await res.json() : await res.text();
    } catch {}

    // ✅ IMPORTANT:
    // /trade returns { request, response }
    // even if HTTP 200, response may be PROTO_OA_ERROR_RES => treat as failure
    const isProtoError =
      body?.response?.payloadType === "PROTO_OA_ERROR_RES" ||
      body?.payloadType === "PROTO_OA_ERROR_RES";

    const ok = res.ok && !isProtoError && !body?.error;

    return {
      ok,
      status: res.status,
      payload: body,
      ...(ok ? {} : { error: isProtoError ? "ctrader_proto_error_res" : `exec_failed status=${res.status}` }),
    };
  } catch (err: any) {
    const isAbort =
      err?.name === "AbortError" ||
      String(err?.message || "").toLowerCase().includes("aborted");

    return {
      ok: false,
      error: isAbort ? `timeout_after_${this.timeoutMs}ms` : (err?.message ?? String(err)),
    };
  } finally {
    clearTimeout(timeout);
  }
}


  async executePendingBatch(opts?: { batchSize?: number }) {
    const batchSize = opts?.batchSize ?? Number(process.env.CTRADER_EXEC_BATCH_SIZE ?? 25);

    const healthy = await this.isHealthy(5000);
    if (!healthy) return;

    const trades = await this.db.claimPendingTrades(batchSize);
    console.log(`[CTRADER] Executing batch of ${trades.length} trades`);
    if (!trades.length) return;

    const updates: { id: number; status: string }[] = [];

    for (const t of trades as any[]) {
      console.log("[CTRADER] Executing trade signal ID:", t);
      const execRes = await this.exectuteTradeSignalApiCall({ ...t, id: t.id });

      if (execRes.ok) {
        updates.push({ id: t.id, status: "executed" });
      } else {
        updates.push({ id: t.id, status: "failed" });
        console.error("[CTRADER] EXEC FAILED", {
          tradeSignalId: t.id,
          error: execRes.error,
          payload: execRes.payload,
        });
      }
    }

    await this.db.updateTradeStatus(updates);
  }

    async exchangeOAuthCode(userId: string | number, code: string): Promise<OAuthExchangeResult> {
    const exchangePath = process.env.CTRADER_OAUTH_EXCHANGE_PATH ?? "/oauth/exchange";
    const url = `${this.baseUrl}${exchangePath}`;

    const started = Date.now();

    const uid = String(userId ?? "").trim();
    if (!uid) {
      return { ok: false, url, latencyMs: 0, error: "missing_userId" };
    }

    const oauthCode = String(code ?? "").trim();
    if (!oauthCode) {
      return { ok: false, url, latencyMs: 0, error: "missing_code" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-user-id": uid,
        },
        body: JSON.stringify({
          code: oauthCode,
          userId: uid,
        }),
        signal: controller.signal,
      });

      const latencyMs = Date.now() - started;

      let payload: any = null;
      const ct = res.headers.get("content-type") ?? "";
      try {
        payload = ct.includes("application/json") ? await res.json() : await res.text();
      } catch {}

      const ok = res.ok && (payload?.ok === undefined ? true : payload?.ok === true);

      return {
        ok,
        url,
        status: res.status,
        latencyMs,
        payload,
        ...(ok ? {} : { error: `oauth_exchange_failed status=${res.status}` }),
      };
    } catch (err: any) {
      const latencyMs = Date.now() - started;
      const isAbort =
        err?.name === "AbortError" || String(err?.message || "").toLowerCase().includes("aborted");

      return {
        ok: false,
        url,
        latencyMs,
        error: isAbort ? `timeout_after_${this.timeoutMs}ms` : (err?.message ?? String(err)),
      };
    } finally {
      clearTimeout(timeout);
    }
  }



async completeOAuthAndVerifyByCTraderAccountId(
  ctraderAccountIdFromState: string,
  code: string
): Promise<CompleteOAuthResult> {
  const qr = AppDataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    const repo = qr.manager.getRepository(UserTradingAccount);

    const ctraderAccountId = String(ctraderAccountIdFromState ?? "").trim();
    if (!ctraderAccountId) {
      await qr.rollbackTransaction();
      return { ok: false, status: 400, error: "state_required" };
    }

    const acc = await repo
      .createQueryBuilder("a")
      .setLock("pessimistic_write")
      .where("a.broker = :broker", { broker: "CTrader" })
      .andWhere("a.accountMeta ->> 'ctraderAccountId' = :cid", { cid: ctraderAccountId })
      .getOne();
    console.log("[CTraderService] completeOAuthAndVerifyByCTraderAccountId found account:", acc);
    if (!acc) {
      await qr.rollbackTransaction();
      return { ok: false, status: 404, error: "trading_account_not_found_for_ctraderAccountId" };
    }
    console.log("l1")

    const userId = Number(acc.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      await qr.rollbackTransaction();
      return { ok: false, status: 500, error: "invalid_userId_on_account" };
    }
    console.log("l2")

    // ✅ Update status + last_verified_at
    // Prefer save() so updated_at is handled by @UpdateDateColumn if you use it
    acc.status = TradingAccountStatus.VERIFIED;

    // MUST match your entity property name that maps to last_verified_at:
    acc.lastVerifiedAt = new Date();
    console.log("l1")
    let dd = await repo.save(acc);
    console.log("l2",dd)
    await qr.commitTransaction();
   console.log("[CTraderService] completeOAuthAndVerifyByCTraderAccountId completed for userId:", {
      ok: true,
      userId,
      rowId: acc.id,
      ctraderAccountId,
    }); 
    return {
      ok: true,
      userId,
      rowId: acc.id,
      ctraderAccountId
    };
  } catch (e: any) {
    try { await qr.rollbackTransaction(); } catch {}
    return { ok: false, status: 500, error: "complete_oauth_failed", details: e?.message ?? String(e) };
  } finally {
    await qr.release();
  }
}


}
