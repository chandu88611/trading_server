import { CTradeSignalDB } from "./cTrader.db";
import AppDataSource from "../../../db/data-source";
import { UserTradingAccount } from "../../../entity/UserTradingAccount";
import { TradingAccountStatus } from "../../subscriptionPlan/enums/subscriberPlan.enum";
import { Broker } from "../../../entity";

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
  orderId?: string | number;
  positionId?: string | number;
  authError?: boolean;
};

type OAuthTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType?: string;
};

type ResolvedGatewayAccountId =
  | { ok: true; accountId: number }
  | { ok: false; status?: number; payload?: any; error: string; authError?: boolean };

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

  private getTokenUrl(): string {
    return String(process.env.CTRADER_TOKEN_URL ?? "https://openapi.ctrader.com/apps/token").trim();
  }

  private requiredEnv(name: string): string {
    const value = String(process.env[name] ?? "").trim();
    if (!value) throw new Error(`missing_env_${name}`);
    return value;
  }

  private normalizeOAuthTokens(raw: any): OAuthTokens {
    const accessToken = String(raw?.accessToken ?? raw?.access_token ?? "").trim();
    const refreshToken = String(raw?.refreshToken ?? raw?.refresh_token ?? "").trim();
    const expiresIn = Number(raw?.expiresIn ?? raw?.expires_in ?? 0);
    const tokenType = String(raw?.tokenType ?? raw?.token_type ?? "").trim();

    if (!accessToken) throw new Error("oauth_response_missing_access_token");
    if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new Error("oauth_response_missing_expires_in");
    }

    return {
      accessToken,
      ...(refreshToken ? { refreshToken } : {}),
      expiresIn,
      ...(tokenType ? { tokenType } : {}),
    };
  }

  private async postOAuthForm(body: URLSearchParams): Promise<OAuthTokens> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(this.getTokenUrl(), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        signal: controller.signal,
      });

      const text = await res.text();
      let json: any;
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { _raw: text };
      }

      if (!res.ok || json?.errorCode || json?.error) {
        const msg = String(json?.description ?? json?.message ?? `http_${res.status}`).trim();
        throw new Error(`oauth_token_error:${msg}`);
      }

      return this.normalizeOAuthTokens(json);
    } catch (err: any) {
      const isAbort =
        err?.name === "AbortError" ||
        String(err?.message ?? "").toLowerCase().includes("aborted");
      throw new Error(isAbort ? `oauth_timeout_after_${this.timeoutMs}ms` : (err?.message ?? String(err)));
    } finally {
      clearTimeout(timeout);
    }
  }

  async exchangeCodeDirect(code: string): Promise<OAuthTokens> {
    const oauthCode = String(code ?? "").trim();
    if (!oauthCode) throw new Error("code_required");

    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", oauthCode);
    body.set("client_id", this.requiredEnv("CTRADER_CLIENT_ID"));
    body.set("client_secret", this.requiredEnv("CTRADER_CLIENT_SECRET"));
    body.set("redirect_uri", this.requiredEnv("CTRADER_REDIRECT_URI"));

    return this.postOAuthForm(body);
  }

  async refreshTokenDirect(refreshToken: string): Promise<OAuthTokens> {
    const refresh = String(refreshToken ?? "").trim();
    if (!refresh) throw new Error("refresh_token_required");

    const body = new URLSearchParams();
    body.set("grant_type", "refresh_token");
    body.set("refresh_token", refresh);
    body.set("client_id", this.requiredEnv("CTRADER_CLIENT_ID"));
    body.set("client_secret", this.requiredEnv("CTRADER_CLIENT_SECRET"));

    return this.postOAuthForm(body);
  }

  private isGatewayTokenAuthError(status?: number, payload?: any, fallbackError?: string): boolean {
    if (status === 401) return true;

    const details = [
      payload?.error,
      payload?.message,
      payload?.description,
      payload?.details,
      payload?.response?.description,
      payload?.response?.message,
      fallbackError,
    ]
      .map((v) => (v == null ? "" : String(v)))
      .join(" ")
      .toLowerCase();

    return [
      "unauthorized",
      "access token",
      "invalid token",
      "token expired",
      "token is expired",
      "oauth",
      "account_auth_error",
      "no access token",
    ].some((needle) => details.includes(needle));
  }

  private resolveGatewayEnv(data?: any): "demo" | "live" | undefined {
    const fromSignal = String(data?.env ?? "").trim().toLowerCase();
    if (fromSignal === "demo" || fromSignal === "live") return fromSignal;

    const fromMeta = String(data?.tradingAccount?.accountMeta?.env ?? "").trim().toLowerCase();
    if (fromMeta === "demo" || fromMeta === "live") return fromMeta;

    const fromProcess = String(process.env.CTRADER_ENV ?? "").trim().toLowerCase();
    if (fromProcess === "demo" || fromProcess === "live") return fromProcess;

    return undefined;
  }

  private toPositiveNumber(v: any): number | null {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }

  private async resolveGatewayAccountId(
    userId: string,
    requestedAccountId: number,
    token: string,
    envHeader?: "demo" | "live",
  ): Promise<ResolvedGatewayAccountId> {
    const url = `${this.baseUrl}/accounts`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          accept: "application/json",
          "x-user-id": userId,
          "x-ctrader-access-token": token,
          ...(envHeader ? { "x-ctrader-env": envHeader } : {}),
        },
        signal: controller.signal,
      });

      let body: any = null;
      const ct = res.headers.get("content-type") ?? "";
      try {
        body = ct.includes("application/json") ? await res.json() : await res.text();
      } catch {}

      if (!res.ok) {
        const authError = this.isGatewayTokenAuthError(
          res.status,
          body,
          typeof body === "string" ? body : undefined,
        );

        return {
          ok: false,
          status: res.status,
          payload: body,
          error: `accounts_fetch_failed status=${res.status}`,
          ...(authError ? { authError: true } : {}),
        };
      }

      const items = Array.isArray(body?.items) ? body.items : [];
      if (!items.length) {
        return {
          ok: false,
          status: res.status,
          payload: body,
          error: "accounts_empty_for_token",
        };
      }

      for (const item of items) {
        const ctid = this.toPositiveNumber(item?.ctidTraderAccountId);
        if (ctid === requestedAccountId) return { ok: true, accountId: ctid };
      }

      for (const item of items) {
        const traderLogin = this.toPositiveNumber(item?.traderLogin);
        const ctid = this.toPositiveNumber(item?.ctidTraderAccountId);
        if (traderLogin === requestedAccountId && ctid) {
          return { ok: true, accountId: ctid };
        }
      }

      if (items.length === 1) {
        const ctid = this.toPositiveNumber(items[0]?.ctidTraderAccountId);
        if (ctid) return { ok: true, accountId: ctid };
      }

      return {
        ok: false,
        status: res.status,
        payload: body,
        error: `gateway_account_not_found_for_accountId=${requestedAccountId}`,
      };
    } catch (err: any) {
      const isAbort =
        err?.name === "AbortError" ||
        String(err?.message || "").toLowerCase().includes("aborted");
      return {
        ok: false,
        error: isAbort ? `accounts_timeout_after_${this.timeoutMs}ms` : (err?.message ?? String(err)),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async exectuteTradeSignalApiCall(data: any): Promise<ExecResult> {
    const execPath = process.env.CTRADER_EXEC_PATH ?? "/trade";
    const url = `${this.baseUrl}${execPath}`;

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
      return "MARKET";
    };

    try {
      const userId = String(
        data?.userId ?? data?.user_id ?? data?.brokerJob?.userId ?? "",
      ).trim();
      if (!userId) return { ok: false, error: "missing_userId_in_signal_data" };

      const tradingAccountId = Number(
        data?.tradingAccountId ?? data?.trading_account_id ?? data?.tradingAccount?.id,
      );
      if (!Number.isFinite(tradingAccountId) || tradingAccountId <= 0) {
        return { ok: false, error: "invalid_tradingAccountId_in_signal_data" };
      }

      const accountId = Number(data?.accountId ?? data?.account_id ?? data?.tradingAccount?.accountId);
      if (!Number.isFinite(accountId) || accountId <= 0) {
        return { ok: false, error: "invalid_accountId_in_signal_data" };
      }

      const accessToken = String(data?.accessToken ?? data?.access_token ?? "").trim();
      if (!accessToken) return { ok: false, error: "missing_accessToken_in_signal_data" };

      const refreshToken = String(data?.refreshToken ?? data?.refresh_token ?? "").trim() || undefined;

      const symbol = String(data?.symbol ?? "").trim();
      if (!symbol) return { ok: false, error: "missing_symbol_in_signal_data" };

      const side =
        normalizeSide(data?.side ?? data?.action ?? data?.signalSide) ??
        normalizeSide(
          String(data?.action ?? "").toLowerCase() === "buy"
            ? "BUY"
            : String(data?.action ?? "").toLowerCase() === "sell"
              ? "SELL"
              : data?.action,
        );
      if (!side) return { ok: false, error: "invalid_side_expected_buy_or_sell" };

      const orderType = normalizeOrderType(data?.orderType);

      const volumeUnits = Number(data?.volumeUnits ?? data?.qty ?? data?.lots ?? 1000);
      if (!Number.isFinite(volumeUnits) || volumeUnits <= 0) {
        return { ok: false, error: "invalid_volumeUnits" };
      }

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

      const payloadBase: any = {
        userId,
        symbol,
        side,
        orderType,
        volumeUnits,
        ...(limitPrice !== undefined ? { limitPrice } : {}),
        ...(stopPrice !== undefined ? { stopPrice } : {}),
        ...(stopLoss !== undefined ? { stopLoss } : {}),
        ...(takeProfit !== undefined ? { takeProfit } : {}),
        ...(stopLossDistance !== undefined ? { stopLossDistance } : {}),
        ...(takeProfitDistance !== undefined ? { takeProfitDistance } : {}),
        ...(comment ? { comment } : {}),
        ...(label ? { label } : {}),
      };
      const envHeader = this.resolveGatewayEnv(data);

      const callGateway = async (token: string): Promise<ExecResult> => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
          const resolved = await this.resolveGatewayAccountId(userId, accountId, token, envHeader);
          if (!resolved.ok) {
            return {
              ok: false,
              status: resolved.status,
              payload: resolved.payload,
              error: resolved.error,
              ...(resolved.authError ? { authError: true } : {}),
            };
          }

          const resolvedAccountId = resolved.accountId;
          if (resolvedAccountId !== accountId) {
            try {
              await this.db.updateTradingAccountAccountId(tradingAccountId, resolvedAccountId);
            } catch {}
          }

          const payload: any = {
            ...payloadBase,
            accountId: resolvedAccountId,
          };

          const res = await fetch(url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              accept: "application/json",
              "x-user-id": userId,
              "x-ctrader-access-token": token,
              ...(envHeader ? { "x-ctrader-env": envHeader } : {}),
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          let body: any = null;
          const ct = res.headers.get("content-type") ?? "";
          try {
            body = ct.includes("application/json") ? await res.json() : await res.text();
          } catch {}

          const responsePayload = body?.response ?? body;
          const isProtoError =
            responsePayload?.payloadType === "PROTO_OA_ERROR_RES" ||
            body?.payloadType === "PROTO_OA_ERROR_RES";

          const ok = res.ok && !isProtoError && !body?.error;
          const orderId =
            responsePayload?.order?.orderId ??
            responsePayload?.orderId ??
            body?.orderId;
          const positionId =
            responsePayload?.position?.positionId ??
            responsePayload?.deal?.positionId ??
            responsePayload?.order?.positionId ??
            body?.positionId;
          const authError = this.isGatewayTokenAuthError(
            res.status,
            body,
            isProtoError ? String(responsePayload?.description ?? "") : undefined,
          );

          return {
            ok,
            status: res.status,
            payload: body,
            ...(orderId !== undefined ? { orderId } : {}),
            ...(positionId !== undefined ? { positionId } : {}),
            ...(ok ? {} : { error: isProtoError ? "ctrader_proto_error_res" : `exec_failed status=${res.status}` }),
            ...(authError ? { authError: true } : {}),
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
      };

      const firstAttempt = await callGateway(accessToken);
      if (firstAttempt.ok || !firstAttempt.authError) return firstAttempt;

      if (!refreshToken) {
        return {
          ...firstAttempt,
          error: "token_refresh_required_but_refresh_token_missing",
        };
      }

      try {
        const refreshed = await this.refreshTokenDirect(refreshToken);
        await this.db.updateTradingAccountTokens(
          tradingAccountId,
          refreshed.accessToken,
          refreshed.refreshToken ?? refreshToken,
        );

        const retryAttempt = await callGateway(refreshed.accessToken);
        if (retryAttempt.ok) return retryAttempt;
        return {
          ...retryAttempt,
          error: retryAttempt.error ?? "exec_failed_after_token_refresh",
        };
      } catch (refreshErr: any) {
        return {
          ok: false,
          status: firstAttempt.status,
          payload: firstAttempt.payload,
          error: `token_refresh_failed:${refreshErr?.message ?? String(refreshErr)}`,
          authError: true,
        };
      }
    } catch (err: any) {
      const isAbort =
        err?.name === "AbortError" ||
        String(err?.message || "").toLowerCase().includes("aborted");

      return {
        ok: false,
        error: isAbort ? `timeout_after_${this.timeoutMs}ms` : (err?.message ?? String(err)),
      };
    }
  }


  async exectuteCloseTradeApiCall(data: any): Promise<ExecResult> {
    const closePath = process.env.CTRADER_CLOSE_PATH ?? "/trade/close";
    const url = `${this.baseUrl}${closePath}`;

    try {
      const userId = String(data?.userId ?? "").trim();
      if (!userId) return { ok: false, error: "missing_userId_in_close_signal_data" };

      const tradingAccountId = Number(
        data?.tradingAccountId ?? data?.trading_account_id ?? data?.tradingAccount?.id,
      );
      if (!Number.isFinite(tradingAccountId) || tradingAccountId <= 0) {
        return { ok: false, error: "invalid_tradingAccountId_in_close_signal_data" };
      }

      const accountId = Number(data?.accountId ?? data?.account_id ?? data?.tradingAccount?.accountId);
      if (!Number.isFinite(accountId) || accountId <= 0) {
        return { ok: false, error: "invalid_accountId_in_close_signal_data" };
      }

      const accessToken = String(data?.accessToken ?? data?.access_token ?? "").trim();
      if (!accessToken) return { ok: false, error: "missing_accessToken_in_close_signal_data" };

      const refreshToken = String(data?.refreshToken ?? data?.refresh_token ?? "").trim() || undefined;

      const orderId = Number(data?.orderId);
      if (!Number.isFinite(orderId) || orderId <= 0) {
        return { ok: false, error: "invalid_orderId_must_be_positive_number" };
      }

      const payloadBase: any = {
        userId,
        positionId: orderId,
        orderId,
      };
      const envHeader = this.resolveGatewayEnv(data);

      const callGateway = async (token: string): Promise<ExecResult> => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
          const resolved = await this.resolveGatewayAccountId(userId, accountId, token, envHeader);
          if (!resolved.ok) {
            return {
              ok: false,
              status: resolved.status,
              payload: resolved.payload,
              error: resolved.error,
              ...(resolved.authError ? { authError: true } : {}),
            };
          }

          const resolvedAccountId = resolved.accountId;
          if (resolvedAccountId !== accountId) {
            try {
              await this.db.updateTradingAccountAccountId(tradingAccountId, resolvedAccountId);
            } catch {}
          }

          const payload: any = {
            ...payloadBase,
            accountId: resolvedAccountId,
          };

          const res = await fetch(url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              accept: "application/json",
              "x-user-id": userId,
              "x-ctrader-access-token": token,
              ...(envHeader ? { "x-ctrader-env": envHeader } : {}),
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          let body: any = null;
          const ct = res.headers.get("content-type") ?? "";
          try {
            body = ct.includes("application/json") ? await res.json() : await res.text();
          } catch {}

          const isProtoError =
            body?.response?.payloadType === "PROTO_OA_ERROR_RES" ||
            body?.payloadType === "PROTO_OA_ERROR_RES";
          const ok = res.ok && !isProtoError && !body?.error;
          const authError = this.isGatewayTokenAuthError(
            res.status,
            body,
            isProtoError ? String(body?.response?.description ?? "") : undefined,
          );

          return {
            ok,
            status: res.status,
            payload: body,
            ...(ok ? {} : { error: isProtoError ? "ctrader_proto_error_res" : `close_exec_failed status=${res.status}` }),
            ...(authError ? { authError: true } : {}),
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
      };

      const firstAttempt = await callGateway(accessToken);
      if (firstAttempt.ok || !firstAttempt.authError) return firstAttempt;

      if (!refreshToken) {
        return {
          ...firstAttempt,
          error: "token_refresh_required_but_refresh_token_missing",
        };
      }

      try {
        const refreshed = await this.refreshTokenDirect(refreshToken);
        await this.db.updateTradingAccountTokens(
          tradingAccountId,
          refreshed.accessToken,
          refreshed.refreshToken ?? refreshToken,
        );

        const retryAttempt = await callGateway(refreshed.accessToken);
        if (retryAttempt.ok) return retryAttempt;
        return {
          ...retryAttempt,
          error: retryAttempt.error ?? "close_exec_failed_after_token_refresh",
        };
      } catch (refreshErr: any) {
        return {
          ok: false,
          status: firstAttempt.status,
          payload: firstAttempt.payload,
          error: `token_refresh_failed:${refreshErr?.message ?? String(refreshErr)}`,
          authError: true,
        };
      }
    } catch (err: any) {
      const isAbort =
        err?.name === "AbortError" ||
        String(err?.message || "").toLowerCase().includes("aborted");

      return {
        ok: false,
        error: isAbort ? `timeout_after_${this.timeoutMs}ms` : (err?.message ?? String(err)),
      };
    }
  }

  async executePendingBatch(opts?: { batchSize?: number }) {
    const batchSize = opts?.batchSize ?? Number(process.env.CTRADER_EXEC_BATCH_SIZE ?? 25);
    //console.log(`************************************[CTRADER] Starting execution of pending trades batch with size ${batchSize}`);
    const healthy = await this.isHealthy(5000);
    if (!healthy) return;

    const trades = await this.db.claimPendingTrades(batchSize);
    //console.log(`[CTRADER] Executing batch of ${trades.length} trades`);
    if (!trades.length) return;

    const updates: { id: number; status: string; orderId?: string | number }[] = [];

    for (const t of trades as any[]) {
      //console.log("[CTRADER] Executing trade signal ID:", t.id);
      const execRes = await this.exectuteTradeSignalApiCall({ ...t, id: t.id });
      const closeRefId = execRes.positionId ?? execRes.orderId;
      //console.log("[CTRADER] Trade signal result:", { tradeSignalId: t.id, positionId: execRes.positionId, orderId: execRes.orderId });
      if (execRes.ok) {
        updates.push({ id: t.id, status: "executed", ...(closeRefId !== undefined ? { orderId: closeRefId } : {}) });
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

  async executeClosePendingBatch(opts?: { batchSize?: number }) {
    const batchSize = opts?.batchSize ?? Number(process.env.CTRADER_EXEC_BATCH_SIZE ?? 25);

    const healthy = await this.isHealthy(5000);
    if (!healthy) return;

    const closeSignals = await this.db.claimPendingCloseTrades(batchSize);
    //console.log(`[CTRADER] Executing batch of ${closeSignals.length} close trades`);
    if (!closeSignals.length) return;

    const updates: { id: number; status: string }[] = [];

    for (const signal of closeSignals as any[]) {
      //console.log("[CTRADER] Executing close trade signal ID:", signal.id);
      const closeRes = await this.exectuteCloseTradeApiCall(signal);
      //console.log("[CTRADER] Close trade signal result:", { signalId: signal.id, ...closeRes });

      if (closeRes.ok) {
        updates.push({ id: signal.id, status: "closed" });
      } else {
        updates.push({ id: signal.id, status: "failed" });
        console.error("[CTRADER] CLOSE FAILED", {
          signalId: signal.id,
          error: closeRes.error,
          payload: closeRes.payload,
        });
      }
    }

    await this.db.updateTradeStatus(updates);
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

    const oauthCode = String(code ?? "").trim();
    if (!oauthCode) {
      await qr.rollbackTransaction();
      return { ok: false, status: 400, error: "code_required" };
    }

    const broker = await qr.manager.getRepository(Broker).findOne({ where: { code: "CT" } });
    if (!broker) {
      await qr.rollbackTransaction();
      return { ok: false, status: 500, error: "ctrader_broker_not_found_in_db" };
    }

    const acc = await repo
      .createQueryBuilder("a")
      .setLock("pessimistic_write")
      .where("a.broker = :broker", { broker: broker.id })
      .andWhere("a.accountId = :accountId", { accountId: ctraderAccountId })
      .getOne();

    if (!acc) {
      await qr.rollbackTransaction();
      return { ok: false, status: 404, error: "trading_account_not_found_for_ctraderAccountId" };
    }

    const userId = Number(acc.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      await qr.rollbackTransaction();
      return { ok: false, status: 500, error: "invalid_userId_on_account" };
    }

    const tokens = await this.exchangeCodeDirect(oauthCode);

    acc.accessToken = tokens.accessToken;
    acc.refreshToken = tokens.refreshToken ?? acc.refreshToken ?? "";
    acc.status = TradingAccountStatus.VERIFIED;
    acc.lastVerifiedAt = new Date();

    await repo.save(acc);
    await qr.commitTransaction();

    return {
      ok: true,
      userId,
      rowId: acc.id,
      ctraderAccountId
    };
  } catch (e: any) {
    await qr.rollbackTransaction();
    return { ok: false, status: 500, error: "complete_oauth_failed", details: e?.message ?? String(e) };
  } finally {
    await qr.release();
  }
}


}
