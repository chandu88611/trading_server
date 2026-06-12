"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CTraderService = void 0;
const cTrader_db_1 = require("./cTrader.db");
const data_source_1 = __importDefault(require("../../../db/data-source"));
const UserTradingAccount_1 = require("../../../entity/UserTradingAccount");
const subscriberPlan_enum_1 = require("../../subscriptionPlan/enums/subscriberPlan.enum");
const entity_1 = require("../../../entity");
class CTraderService {
    constructor(opts) {
        this.lastHealthAt = 0;
        this.lastHealth = null;
        const legacyTimeoutMs = opts?.timeoutMs;
        this.baseUrl = (opts?.baseUrl ?? process.env.CTRADER_GATEWAY_URL ?? "http://69.62.126.107:8089").replace(/\/+$/, "");
        this.healthTimeoutMs = opts?.healthTimeoutMs
            ?? legacyTimeoutMs
            ?? Number(process.env.CTRADER_HEALTH_TIMEOUT_MS ?? 5000);
        this.requestTimeoutMs = opts?.requestTimeoutMs
            ?? legacyTimeoutMs
            ?? Number(process.env.CTRADER_EXEC_TIMEOUT_MS ?? process.env.CTRADER_REQUEST_TIMEOUT_MS ?? 15000);
        this.maxRetryAttempts = opts?.maxRetryAttempts
            ?? Number(process.env.CTRADER_EXEC_MAX_RETRY_ATTEMPTS ?? 5);
        this.retryBaseDelayMs = opts?.retryBaseDelayMs
            ?? Number(process.env.CTRADER_EXEC_RETRY_BASE_MS ?? 1500);
        this.db = new cTrader_db_1.CTradeSignalDB();
    }
    async ensureSchema() {
        await this.db.ensureSchema();
    }
    async checkConnection() {
        const url = `${this.baseUrl}/health`;
        const started = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.healthTimeoutMs);
        try {
            const res = await fetch(url, {
                method: "GET",
                headers: { accept: "application/json" },
                signal: controller.signal,
            });
            const latencyMs = Date.now() - started;
            let payload = null;
            const contentType = res.headers.get("content-type") ?? "";
            try {
                payload = contentType.includes("application/json") ? await res.json() : await res.text();
            }
            catch { }
            const ok = res.ok &&
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
        }
        catch (err) {
            const latencyMs = Date.now() - started;
            const isAbort = err?.name === "AbortError" || String(err?.message || "").toLowerCase().includes("aborted");
            return {
                ok: false,
                url,
                latencyMs,
                error: isAbort ? `timeout_after_${this.healthTimeoutMs}ms` : (err?.message ?? String(err)),
            };
        }
        finally {
            clearTimeout(timeout);
        }
    }
    async isHealthy(ttlMs = 5000) {
        const now = Date.now();
        if (this.lastHealth && now - this.lastHealthAt < ttlMs)
            return this.lastHealth.ok;
        const h = await this.checkConnection();
        this.lastHealth = h;
        this.lastHealthAt = now;
        return h.ok;
    }
    async makeCall({ start, count }) {
        return this.db.getAllTradeTo({ start, count });
    }
    /**
     * Read account funds/balance for a user's cTrader account via the gateway's
     * GET /account (PROTO_OA_TRADER_RES). cTrader money is scaled by moneyDigits.
     * Normalized to the shared funds shape used by Zebu/Dhan/MT5.
     */
    async getFunds(userId, tradingAccountId) {
        const acc = await this.db.getAccountForFunds(userId, tradingAccountId);
        if (!acc) {
            throw { statusCode: 404, message: "trading_account_not_found" };
        }
        if (!acc.accessToken) {
            throw { statusCode: 400, message: "ctrader_account_not_authorized" };
        }
        const callAccount = async (token) => {
            const url = `${this.baseUrl}/account`;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
            try {
                const res = await fetch(url, {
                    method: "GET",
                    headers: {
                        accept: "application/json",
                        "x-user-id": acc.gatewayUserId,
                        "x-ctrader-access-token": token,
                        "x-ctrader-env": acc.env,
                    },
                    signal: controller.signal,
                });
                const ct = res.headers.get("content-type") ?? "";
                let body = null;
                try {
                    body = ct.includes("application/json") ? await res.json() : await res.text();
                }
                catch { }
                return { ok: res.ok, status: res.status, body };
            }
            finally {
                clearTimeout(timer);
            }
        };
        let attempt = await callAccount(acc.accessToken);
        // One refresh-and-retry on auth failure.
        if (!attempt.ok && this.isGatewayTokenAuthError(attempt.status, attempt.body) && acc.refreshToken) {
            try {
                const refreshed = await this.refreshTokenDirect(acc.refreshToken);
                await this.db.updateTradingAccountTokens(acc.tradingAccountId, refreshed.accessToken, refreshed.refreshToken);
                attempt = await callAccount(refreshed.accessToken);
            }
            catch {
                /* fall through to error below */
            }
        }
        if (!attempt.ok) {
            throw {
                statusCode: 502,
                message: "ctrader_account_fetch_failed",
                data: { status: attempt.status, payload: attempt.body },
            };
        }
        const decoded = attempt.body?.decoded ?? attempt.body ?? {};
        const trader = decoded?.trader ?? decoded ?? {};
        const moneyDigits = Number(trader?.moneyDigits ?? 2);
        const scale = Math.pow(10, Number.isFinite(moneyDigits) ? moneyDigits : 2);
        const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
        const balance = num(trader?.balance) / scale;
        return {
            ok: true,
            availableCash: balance,
            marginUsed: 0,
            collateral: 0,
            totalFunds: balance,
            currency: trader?.depositAssetId ? String(trader.depositAssetId) : undefined,
            raw: trader,
        };
    }
    getTokenUrl() {
        return String(process.env.CTRADER_TOKEN_URL ?? "https://openapi.ctrader.com/apps/token").trim();
    }
    requiredEnv(name) {
        const value = String(process.env[name] ?? "").trim();
        if (!value)
            throw new Error(`missing_env_${name}`);
        return value;
    }
    normalizeOAuthTokens(raw) {
        const accessToken = String(raw?.accessToken ?? raw?.access_token ?? "").trim();
        const refreshToken = String(raw?.refreshToken ?? raw?.refresh_token ?? "").trim();
        const expiresIn = Number(raw?.expiresIn ?? raw?.expires_in ?? 0);
        const tokenType = String(raw?.tokenType ?? raw?.token_type ?? "").trim();
        if (!accessToken)
            throw new Error("oauth_response_missing_access_token");
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
    async postOAuthForm(body) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
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
            let json;
            try {
                json = text ? JSON.parse(text) : {};
            }
            catch {
                json = { _raw: text };
            }
            if (!res.ok || json?.errorCode || json?.error) {
                const msg = String(json?.description ?? json?.message ?? `http_${res.status}`).trim();
                throw new Error(`oauth_token_error:${msg}`);
            }
            return this.normalizeOAuthTokens(json);
        }
        catch (err) {
            const isAbort = err?.name === "AbortError" ||
                String(err?.message ?? "").toLowerCase().includes("aborted");
            throw new Error(isAbort ? `oauth_timeout_after_${this.requestTimeoutMs}ms` : (err?.message ?? String(err)));
        }
        finally {
            clearTimeout(timeout);
        }
    }
    isTransientExecutionFailure(result) {
        const status = Number(result?.status ?? 0);
        if (status >= 500 && status < 600)
            return true;
        const errorText = String(result?.error ?? "").trim().toLowerCase();
        if (!errorText)
            return false;
        return [
            "timeout_after_",
            "accounts_timeout_after_",
            "accounts_fetch_failed status=500",
            "accounts_fetch_failed status=502",
            "accounts_fetch_failed status=503",
            "exec_failed status=500",
            "exec_failed status=502",
            "exec_failed status=503",
            "close_exec_failed status=500",
            "close_exec_failed status=502",
            "close_exec_failed status=503",
            "disconnected",
            "not connected",
            "fetch failed",
            "appauth",
            "readypromise rejected",
        ].some((needle) => errorText.includes(needle));
    }
    async exchangeCodeDirect(code) {
        const oauthCode = String(code ?? "").trim();
        if (!oauthCode)
            throw new Error("code_required");
        const body = new URLSearchParams();
        body.set("grant_type", "authorization_code");
        body.set("code", oauthCode);
        body.set("client_id", this.requiredEnv("CTRADER_CLIENT_ID"));
        body.set("client_secret", this.requiredEnv("CTRADER_CLIENT_SECRET"));
        body.set("redirect_uri", this.requiredEnv("CTRADER_REDIRECT_URI"));
        return this.postOAuthForm(body);
    }
    async refreshTokenDirect(refreshToken) {
        const refresh = String(refreshToken ?? "").trim();
        if (!refresh)
            throw new Error("refresh_token_required");
        const body = new URLSearchParams();
        body.set("grant_type", "refresh_token");
        body.set("refresh_token", refresh);
        body.set("client_id", this.requiredEnv("CTRADER_CLIENT_ID"));
        body.set("client_secret", this.requiredEnv("CTRADER_CLIENT_SECRET"));
        return this.postOAuthForm(body);
    }
    async findActiveSubscriptionForBrokerMarket(queryRunner, userId, marketCategory) {
        const normalizedMarket = String(marketCategory ?? "").trim().toUpperCase();
        if (!Number.isFinite(userId) || userId <= 0 || !normalizedMarket)
            return null;
        return queryRunner.manager
            .getRepository(entity_1.UserSubscription)
            .createQueryBuilder("subscription")
            .innerJoinAndSelect("subscription.plan", "plan")
            .innerJoinAndSelect("plan.market", "market")
            .where("subscription.userId = :userId", { userId })
            .andWhere("(subscription.statusV2 = :active OR subscription.status = :active)", {
            active: subscriberPlan_enum_1.SubscriptionStatus.ACTIVE,
        })
            .andWhere("UPPER(market.code) = :market", { market: normalizedMarket })
            .orderBy("subscription.updatedAt", "DESC")
            .addOrderBy("subscription.id", "DESC")
            .getOne();
    }
    async rebindAccountToActiveSubscription(queryRunner, acc, broker) {
        const userId = Number(acc.userId);
        const activeSubscription = await this.findActiveSubscriptionForBrokerMarket(queryRunner, userId, broker.marketCategory);
        if (!activeSubscription)
            return;
        const currentSubscriptionId = Number(acc.subscriptionId);
        const activeSubscriptionId = Number(activeSubscription.id);
        if (currentSubscriptionId === activeSubscriptionId)
            return;
        console.log("[CTRADER] rebinding verified account to active subscription", {
            userId,
            tradingAccountId: acc.id,
            accountId: acc.accountId,
            brokerCode: broker.code,
            marketCategory: broker.marketCategory,
            previousSubscriptionId: Number.isFinite(currentSubscriptionId)
                ? currentSubscriptionId
                : null,
            activeSubscriptionId,
        });
        acc.subscriptionId = activeSubscriptionId;
    }
    isGatewayTokenAuthError(status, payload, fallbackError) {
        if (status === 401)
            return true;
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
    resolveGatewayEnv(data) {
        const fromSignal = String(data?.env ?? "").trim().toLowerCase();
        if (fromSignal === "demo" || fromSignal === "live")
            return fromSignal;
        const fromMeta = String(data?.tradingAccount?.accountMeta?.env ?? "").trim().toLowerCase();
        if (fromMeta === "demo" || fromMeta === "live")
            return fromMeta;
        const fromProcess = String(process.env.CTRADER_ENV ?? "").trim().toLowerCase();
        if (fromProcess === "demo" || fromProcess === "live")
            return fromProcess;
        return undefined;
    }
    toPositiveNumber(v) {
        const n = Number(v);
        if (!Number.isFinite(n) || n <= 0)
            return null;
        return n;
    }
    toPositiveBrokerRef(v) {
        if (v === undefined || v === null || v === "")
            return undefined;
        const n = Number(v);
        if (!Number.isFinite(n) || n <= 0)
            return undefined;
        return typeof v === "string" ? String(v) : n;
    }
    async resolveGatewayAccountId(userId, requestedAccountId, token, envHeader) {
        const url = `${this.baseUrl}/accounts`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
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
            let body = null;
            const ct = res.headers.get("content-type") ?? "";
            try {
                body = ct.includes("application/json") ? await res.json() : await res.text();
            }
            catch { }
            if (!res.ok) {
                const authError = this.isGatewayTokenAuthError(res.status, body, typeof body === "string" ? body : undefined);
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
                if (ctid === requestedAccountId)
                    return { ok: true, accountId: ctid };
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
                if (ctid)
                    return { ok: true, accountId: ctid };
            }
            return {
                ok: false,
                status: res.status,
                payload: body,
                error: `gateway_account_not_found_for_accountId=${requestedAccountId}`,
            };
        }
        catch (err) {
            const isAbort = err?.name === "AbortError" ||
                String(err?.message || "").toLowerCase().includes("aborted");
            return {
                ok: false,
                error: isAbort ? `accounts_timeout_after_${this.requestTimeoutMs}ms` : (err?.message ?? String(err)),
            };
        }
        finally {
            clearTimeout(timeout);
        }
    }
    async exectuteTradeSignalApiCall(data) {
        const execPath = process.env.CTRADER_EXEC_PATH ?? "/trade";
        const url = `${this.baseUrl}${execPath}`;
        const normalizeSide = (v) => {
            const s = String(v ?? "").trim().toUpperCase();
            if (s === "BUY" || s === "B")
                return "BUY";
            if (s === "SELL" || s === "S")
                return "SELL";
            if (s === "LONG")
                return "BUY";
            if (s === "SHORT")
                return "SELL";
            return null;
        };
        const normalizeOrderType = (v) => {
            const s = String(v ?? "").trim().toUpperCase();
            if (s === "MARKET" || s === "MKT")
                return "MARKET";
            if (s === "LIMIT")
                return "LIMIT";
            if (s === "STOP")
                return "STOP";
            if (s === "STOP_LIMIT" || s === "STOPLIMIT")
                return "STOP_LIMIT";
            if (s === "MARKET_RANGE" || s === "MARKETRANGE")
                return "MARKET_RANGE";
            return "MARKET";
        };
        const normalizeExecutionMode = (v) => {
            const s = String(v ?? "").trim().toUpperCase();
            return s === "AMEND_SLTP" ? "AMEND_SLTP" : "OPEN";
        };
        const optBool = (v) => {
            if (v === undefined || v === null || v === "")
                return undefined;
            if (typeof v === "boolean")
                return v;
            const text = String(v).trim().toLowerCase();
            if (text === "true" || text === "1")
                return true;
            if (text === "false" || text === "0")
                return false;
            return undefined;
        };
        const firstDefined = (...values) => values.find((value) => value !== undefined);
        try {
            const tradeSignalId = Number(data?.id ?? data?.tradeSignalId ?? data?.jobId);
            const userId = String(data?.userId ?? data?.user_id ?? data?.brokerJob?.userId ?? "").trim();
            if (!userId)
                return { ok: false, error: "missing_userId_in_signal_data" };
            const tradingAccountId = Number(data?.tradingAccountId ?? data?.trading_account_id ?? data?.tradingAccount?.id);
            if (!Number.isFinite(tradingAccountId) || tradingAccountId <= 0) {
                return { ok: false, error: "invalid_tradingAccountId_in_signal_data" };
            }
            const accountId = Number(data?.accountId ?? data?.account_id ?? data?.tradingAccount?.accountId);
            if (!Number.isFinite(accountId) || accountId <= 0) {
                return { ok: false, error: "invalid_accountId_in_signal_data" };
            }
            const accessToken = String(data?.accessToken ?? data?.access_token ?? "").trim();
            if (!accessToken)
                return { ok: false, error: "missing_accessToken_in_signal_data" };
            const refreshToken = String(data?.refreshToken ?? data?.refresh_token ?? "").trim() || undefined;
            const executionMode = normalizeExecutionMode(data?.executionMode);
            const entryRef = String(data?.entryRef ?? "").trim() || undefined;
            const stopLoss = data?.stopLoss !== undefined && data?.stopLoss !== null
                ? Number(data.stopLoss)
                : undefined;
            const takeProfit = data?.takeProfit !== undefined && data?.takeProfit !== null
                ? Number(data.takeProfit)
                : undefined;
            const stopLossDistance = data?.stopLossDistance !== undefined && data?.stopLossDistance !== null
                ? Number(data.stopLossDistance)
                : undefined;
            const takeProfitDistance = data?.takeProfitDistance !== undefined && data?.takeProfitDistance !== null
                ? Number(data.takeProfitDistance)
                : undefined;
            const stopLossAmount = data?.stopLossAmount !== undefined && data?.stopLossAmount !== null
                ? Number(data.stopLossAmount)
                : undefined;
            const takeProfitAmount = data?.takeProfitAmount !== undefined && data?.takeProfitAmount !== null
                ? Number(data.takeProfitAmount)
                : undefined;
            const limitPrice = data?.limitPrice !== undefined && data?.limitPrice !== null
                ? Number(data.limitPrice)
                : undefined;
            const stopPrice = data?.stopPrice !== undefined && data?.stopPrice !== null
                ? Number(data.stopPrice)
                : undefined;
            const trailingStopLoss = optBool(data?.trailingStopLoss);
            const guaranteedStopLoss = optBool(data?.guaranteedStopLoss);
            const stopLossTriggerMethod = String(data?.stopLossTriggerMethod ?? "").trim() || undefined;
            const trailingTakeProfitActivationDistance = data?.trailingTakeProfitActivationDistance !== undefined &&
                data?.trailingTakeProfitActivationDistance !== null
                ? Number(data.trailingTakeProfitActivationDistance)
                : undefined;
            const trailingTakeProfitDistance = data?.trailingTakeProfitDistance !== undefined &&
                data?.trailingTakeProfitDistance !== null
                ? Number(data.trailingTakeProfitDistance)
                : undefined;
            const breakEvenActivationRaw = firstDefined(data?.breakEvenActivationDistance, data?.breakEvenAfterPips, data?.moveStopLossToBreakEvenAfterPips);
            const breakEvenOffsetRaw = firstDefined(data?.breakEvenOffsetDistance, data?.breakEvenOffsetPips);
            const trailingStopLossDistanceRaw = firstDefined(data?.trailingStopLossDistance, data?.trailingStopDistancePips);
            const breakEvenActivationDistance = breakEvenActivationRaw !== undefined && breakEvenActivationRaw !== null
                ? Number(breakEvenActivationRaw)
                : undefined;
            const breakEvenOffsetDistance = breakEvenOffsetRaw !== undefined && breakEvenOffsetRaw !== null
                ? Number(breakEvenOffsetRaw)
                : undefined;
            const trailingStopLossDistance = trailingStopLossDistanceRaw !== undefined && trailingStopLossDistanceRaw !== null
                ? Number(trailingStopLossDistanceRaw)
                : undefined;
            const comment = String(data?.comment ?? "").trim() ||
                [
                    entryRef ? `entryRef=${entryRef}` : "",
                    tradeSignalId ? `tradeSignalId=${tradeSignalId}` : "",
                    data?.jobId ? `jobId=${data.jobId}` : "",
                ]
                    .filter(Boolean)
                    .join(" ")
                    .trim();
            const label = String(data?.label ?? "").trim() || entryRef || "signal-exec";
            let payloadBase;
            if (executionMode === "AMEND_SLTP") {
                if (!entryRef)
                    return { ok: false, error: "entry_ref_required_for_amend" };
                const sourceSignal = await this.db.findLatestOpenSignalByEntryRef(tradingAccountId, entryRef, Number.isFinite(tradeSignalId) ? tradeSignalId : undefined);
                if (!sourceSignal) {
                    return { ok: false, error: "amend_target_not_found" };
                }
                const brokerOrderId = sourceSignal.brokerOrderId ?? (sourceSignal.orderId != null ? String(sourceSignal.orderId) : null);
                const brokerPositionId = sourceSignal.brokerPositionId ?? null;
                const disablesTrailingTakeProfit = stopLoss === undefined &&
                    takeProfit === undefined &&
                    trailingTakeProfitActivationDistance === undefined &&
                    trailingTakeProfitDistance === undefined &&
                    breakEvenActivationDistance === undefined &&
                    breakEvenOffsetDistance === undefined &&
                    trailingStopLossDistance === undefined;
                const lifecycleTradeSignalId = Number(sourceSignal.id);
                const sourceSide = normalizeSide(sourceSignal.action);
                payloadBase = {
                    userId,
                    tradingAccountId,
                    executionMode,
                    tradeSignalId: Number.isFinite(lifecycleTradeSignalId)
                        ? lifecycleTradeSignalId
                        : tradeSignalId,
                    entryRef,
                    symbol: String(sourceSignal.symbol ?? "").trim() || undefined,
                    side: sourceSide ?? undefined,
                    ...(brokerOrderId ? { orderId: brokerOrderId } : {}),
                    ...(brokerPositionId ? { positionId: brokerPositionId } : {}),
                    ...(stopLoss !== undefined ? { stopLoss } : {}),
                    ...(takeProfit !== undefined ? { takeProfit } : {}),
                    ...(trailingStopLoss !== undefined ? { trailingStopLoss } : {}),
                    ...(guaranteedStopLoss !== undefined ? { guaranteedStopLoss } : {}),
                    ...(stopLossTriggerMethod ? { stopLossTriggerMethod } : {}),
                    ...(trailingTakeProfitActivationDistance !== undefined
                        ? { trailingTakeProfitActivationDistance }
                        : {}),
                    ...(trailingTakeProfitDistance !== undefined ? { trailingTakeProfitDistance } : {}),
                    ...(breakEvenActivationDistance !== undefined
                        ? { breakEvenActivationDistance }
                        : {}),
                    ...(breakEvenOffsetDistance !== undefined ? { breakEvenOffsetDistance } : {}),
                    ...(trailingStopLossDistance !== undefined ? { trailingStopLossDistance } : {}),
                    ...(disablesTrailingTakeProfit
                        ? {
                            trailingTakeProfitActivationDistance: null,
                            trailingTakeProfitDistance: null,
                        }
                        : {}),
                    ...(comment ? { comment } : {}),
                };
            }
            else {
                const symbol = String(data?.symbol ?? "").trim();
                if (!symbol)
                    return { ok: false, error: "missing_symbol_in_signal_data" };
                const side = normalizeSide(data?.side ?? data?.action ?? data?.signalSide) ??
                    normalizeSide(String(data?.action ?? "").toLowerCase() === "buy"
                        ? "BUY"
                        : String(data?.action ?? "").toLowerCase() === "sell"
                            ? "SELL"
                            : data?.action);
                if (!side)
                    return { ok: false, error: "invalid_side_expected_buy_or_sell" };
                const orderType = normalizeOrderType(data?.orderType);
                const volumeUnitsRaw = Number(data?.volumeUnits ?? data?.qty);
                const volumeLotsRaw = Number(data?.volumeLots ?? data?.lots ?? data?.volume);
                const hasVolumeUnits = Number.isFinite(volumeUnitsRaw) && volumeUnitsRaw > 0;
                const hasVolumeLots = Number.isFinite(volumeLotsRaw) && volumeLotsRaw > 0;
                if (!hasVolumeUnits && !hasVolumeLots) {
                    return { ok: false, error: "invalid_volume_expected_units_or_lots" };
                }
                payloadBase = {
                    userId,
                    tradingAccountId,
                    executionMode,
                    tradeSignalId,
                    entryRef,
                    symbol,
                    side,
                    orderType,
                    ...(hasVolumeUnits ? { volumeUnits: volumeUnitsRaw } : {}),
                    ...(hasVolumeLots ? { volumeLots: volumeLotsRaw } : {}),
                    ...(limitPrice !== undefined ? { limitPrice } : {}),
                    ...(stopPrice !== undefined ? { stopPrice } : {}),
                    ...(stopLoss !== undefined ? { stopLoss } : {}),
                    ...(takeProfit !== undefined ? { takeProfit } : {}),
                    ...(stopLossDistance !== undefined ? { stopLossDistance } : {}),
                    ...(takeProfitDistance !== undefined ? { takeProfitDistance } : {}),
                    ...(stopLossAmount !== undefined ? { stopLossAmount } : {}),
                    ...(takeProfitAmount !== undefined ? { takeProfitAmount } : {}),
                    ...(trailingStopLoss !== undefined ? { trailingStopLoss } : {}),
                    ...(guaranteedStopLoss !== undefined ? { guaranteedStopLoss } : {}),
                    ...(stopLossTriggerMethod ? { stopLossTriggerMethod } : {}),
                    ...(trailingTakeProfitActivationDistance !== undefined
                        ? { trailingTakeProfitActivationDistance }
                        : {}),
                    ...(trailingTakeProfitDistance !== undefined ? { trailingTakeProfitDistance } : {}),
                    ...(breakEvenActivationDistance !== undefined
                        ? { breakEvenActivationDistance }
                        : {}),
                    ...(breakEvenOffsetDistance !== undefined ? { breakEvenOffsetDistance } : {}),
                    ...(trailingStopLossDistance !== undefined ? { trailingStopLossDistance } : {}),
                    ...(comment ? { comment } : {}),
                    ...(label ? { label } : {}),
                };
            }
            const envHeader = this.resolveGatewayEnv(data);
            const callGateway = async (token) => {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
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
                        }
                        catch { }
                    }
                    const payload = {
                        ...payloadBase,
                        accountId: resolvedAccountId,
                    };
                    console.log("[CTRADER->GATEWAY] open_trade_request", {
                        url,
                        userId,
                        env: envHeader ?? null,
                        tradingAccountId,
                        requestedAccountId: accountId,
                        resolvedAccountId,
                        tradeSignalId: Number.isFinite(tradeSignalId) ? tradeSignalId : null,
                        payload,
                    });
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
                    console.log("[CTRADER->GATEWAY] open_trade_response", {
                        url,
                        userId,
                        env: envHeader ?? null,
                        tradingAccountId,
                        resolvedAccountId,
                        tradeSignalId: Number.isFinite(tradeSignalId) ? tradeSignalId : null,
                        status: res.status,
                        ok: res.ok,
                    });
                    let body = null;
                    const ct = res.headers.get("content-type") ?? "";
                    try {
                        body = ct.includes("application/json") ? await res.json() : await res.text();
                    }
                    catch { }
                    const responsePayload = body?.response ?? body;
                    const isProtoError = responsePayload?.payloadType === "PROTO_OA_ERROR_RES" ||
                        body?.payloadType === "PROTO_OA_ERROR_RES";
                    const ok = res.ok && !isProtoError && !body?.error;
                    const orderId = this.toPositiveBrokerRef(body?.orderId ??
                        responsePayload?.order?.orderId ??
                        responsePayload?.orderId ??
                        responsePayload?.deal?.orderId);
                    const positionId = this.toPositiveBrokerRef(body?.positionId ??
                        responsePayload?.position?.positionId ??
                        responsePayload?.deal?.positionId ??
                        responsePayload?.order?.positionId);
                    const authError = this.isGatewayTokenAuthError(res.status, body, isProtoError ? String(responsePayload?.description ?? "") : undefined);
                    const hasUsableBrokerRef = positionId !== undefined || orderId !== undefined;
                    const missingOpenRefs = executionMode !== "AMEND_SLTP" &&
                        ok &&
                        !hasUsableBrokerRef;
                    return {
                        ok: missingOpenRefs ? false : ok,
                        status: res.status,
                        payload: body,
                        ...(orderId !== undefined ? { orderId } : {}),
                        ...(positionId !== undefined ? { positionId } : {}),
                        ...((missingOpenRefs || !ok)
                            ? {
                                error: missingOpenRefs
                                    ? "execution_missing_broker_refs"
                                    : isProtoError
                                        ? "ctrader_proto_error_res"
                                        : `exec_failed status=${res.status}`,
                            }
                            : {}),
                        ...(authError ? { authError: true } : {}),
                    };
                }
                catch (err) {
                    const isAbort = err?.name === "AbortError" ||
                        String(err?.message || "").toLowerCase().includes("aborted");
                    return {
                        ok: false,
                        error: isAbort ? `timeout_after_${this.requestTimeoutMs}ms` : (err?.message ?? String(err)),
                    };
                }
                finally {
                    clearTimeout(timeout);
                }
            };
            const firstAttempt = await callGateway(accessToken);
            if (firstAttempt.ok || !firstAttempt.authError)
                return firstAttempt;
            if (!refreshToken) {
                return {
                    ...firstAttempt,
                    error: "token_refresh_required_but_refresh_token_missing",
                };
            }
            try {
                const refreshed = await this.refreshTokenDirect(refreshToken);
                await this.db.updateTradingAccountTokens(tradingAccountId, refreshed.accessToken, refreshed.refreshToken ?? refreshToken);
                const retryAttempt = await callGateway(refreshed.accessToken);
                if (retryAttempt.ok)
                    return retryAttempt;
                return {
                    ...retryAttempt,
                    error: retryAttempt.error ?? "exec_failed_after_token_refresh",
                };
            }
            catch (refreshErr) {
                return {
                    ok: false,
                    status: firstAttempt.status,
                    payload: firstAttempt.payload,
                    error: `token_refresh_failed:${refreshErr?.message ?? String(refreshErr)}`,
                    authError: true,
                };
            }
        }
        catch (err) {
            const isAbort = err?.name === "AbortError" ||
                String(err?.message || "").toLowerCase().includes("aborted");
            return {
                ok: false,
                error: isAbort ? `timeout_after_${this.requestTimeoutMs}ms` : (err?.message ?? String(err)),
            };
        }
    }
    async exectuteCloseTradeApiCall(data) {
        const closePath = process.env.CTRADER_CLOSE_PATH ?? "/trade/close";
        const url = `${this.baseUrl}${closePath}`;
        try {
            const userId = String(data?.userId ?? "").trim();
            if (!userId)
                return { ok: false, error: "missing_userId_in_close_signal_data" };
            const tradingAccountId = Number(data?.tradingAccountId ?? data?.trading_account_id ?? data?.tradingAccount?.id);
            if (!Number.isFinite(tradingAccountId) || tradingAccountId <= 0) {
                return { ok: false, error: "invalid_tradingAccountId_in_close_signal_data" };
            }
            const accountId = Number(data?.accountId ?? data?.account_id ?? data?.tradingAccount?.accountId);
            if (!Number.isFinite(accountId) || accountId <= 0) {
                return { ok: false, error: "invalid_accountId_in_close_signal_data" };
            }
            const accessToken = String(data?.accessToken ?? data?.access_token ?? "").trim();
            if (!accessToken)
                return { ok: false, error: "missing_accessToken_in_close_signal_data" };
            const refreshToken = String(data?.refreshToken ?? data?.refresh_token ?? "").trim() || undefined;
            const orderId = Number(data?.orderId);
            if (!Number.isFinite(orderId) || orderId <= 0) {
                return { ok: false, error: "invalid_orderId_must_be_positive_number" };
            }
            const payloadBase = {
                userId,
                positionId: orderId,
                orderId,
            };
            const envHeader = this.resolveGatewayEnv(data);
            const callGateway = async (token) => {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
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
                        }
                        catch { }
                    }
                    const payload = {
                        ...payloadBase,
                        accountId: resolvedAccountId,
                    };
                    console.log("[CTRADER->GATEWAY] close_trade_request", {
                        url,
                        userId,
                        env: envHeader ?? null,
                        tradingAccountId,
                        requestedAccountId: accountId,
                        resolvedAccountId,
                        orderId,
                        payload,
                    });
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
                    console.log("[CTRADER->GATEWAY] close_trade_response", {
                        url,
                        userId,
                        env: envHeader ?? null,
                        tradingAccountId,
                        resolvedAccountId,
                        orderId,
                        status: res.status,
                        ok: res.ok,
                    });
                    let body = null;
                    const ct = res.headers.get("content-type") ?? "";
                    try {
                        body = ct.includes("application/json") ? await res.json() : await res.text();
                    }
                    catch { }
                    const isProtoError = body?.response?.payloadType === "PROTO_OA_ERROR_RES" ||
                        body?.payloadType === "PROTO_OA_ERROR_RES";
                    const ok = res.ok && !isProtoError && !body?.error;
                    const authError = this.isGatewayTokenAuthError(res.status, body, isProtoError ? String(body?.response?.description ?? "") : undefined);
                    return {
                        ok,
                        status: res.status,
                        payload: body,
                        ...(ok ? {} : { error: isProtoError ? "ctrader_proto_error_res" : `close_exec_failed status=${res.status}` }),
                        ...(authError ? { authError: true } : {}),
                    };
                }
                catch (err) {
                    const isAbort = err?.name === "AbortError" ||
                        String(err?.message || "").toLowerCase().includes("aborted");
                    return {
                        ok: false,
                        error: isAbort ? `timeout_after_${this.requestTimeoutMs}ms` : (err?.message ?? String(err)),
                    };
                }
                finally {
                    clearTimeout(timeout);
                }
            };
            const firstAttempt = await callGateway(accessToken);
            if (firstAttempt.ok || !firstAttempt.authError)
                return firstAttempt;
            if (!refreshToken) {
                return {
                    ...firstAttempt,
                    error: "token_refresh_required_but_refresh_token_missing",
                };
            }
            try {
                const refreshed = await this.refreshTokenDirect(refreshToken);
                await this.db.updateTradingAccountTokens(tradingAccountId, refreshed.accessToken, refreshed.refreshToken ?? refreshToken);
                const retryAttempt = await callGateway(refreshed.accessToken);
                if (retryAttempt.ok)
                    return retryAttempt;
                return {
                    ...retryAttempt,
                    error: retryAttempt.error ?? "close_exec_failed_after_token_refresh",
                };
            }
            catch (refreshErr) {
                return {
                    ok: false,
                    status: firstAttempt.status,
                    payload: firstAttempt.payload,
                    error: `token_refresh_failed:${refreshErr?.message ?? String(refreshErr)}`,
                    authError: true,
                };
            }
        }
        catch (err) {
            const isAbort = err?.name === "AbortError" ||
                String(err?.message || "").toLowerCase().includes("aborted");
            return {
                ok: false,
                error: isAbort ? `timeout_after_${this.requestTimeoutMs}ms` : (err?.message ?? String(err)),
            };
        }
    }
    async executePendingBatch(opts) {
        const batchSize = opts?.batchSize ?? Number(process.env.CTRADER_EXEC_BATCH_SIZE ?? 25);
        //console.log(`************************************[CTRADER] Starting execution of pending trades batch with size ${batchSize}`);
        const healthy = await this.isHealthy(5000);
        if (!healthy)
            return;
        const trades = await this.db.claimPendingTrades(batchSize);
        //console.log(`[CTRADER] Executing batch of ${trades.length} trades`);
        if (!trades.length)
            return;
        const updates = [];
        for (const t of trades) {
            //console.log("[CTRADER] Executing trade signal ID:", t.id);
            const execRes = await this.exectuteTradeSignalApiCall({ ...t, id: t.id });
            const closeRefId = execRes.positionId ?? execRes.orderId;
            //console.log("[CTRADER] Trade signal result:", { tradeSignalId: t.id, positionId: execRes.positionId, orderId: execRes.orderId });
            if (execRes.ok) {
                updates.push({
                    id: t.id,
                    status: "executed",
                    ...(closeRefId !== undefined ? { orderId: closeRefId } : {}),
                    ...(execRes.orderId !== undefined ? { brokerOrderId: execRes.orderId } : {}),
                    ...(execRes.positionId !== undefined ? { brokerPositionId: execRes.positionId } : {}),
                });
            }
            else {
                const nextStatus = this.isTransientExecutionFailure(execRes) ? "retry_pending" : "failed";
                updates.push({
                    id: t.id,
                    status: nextStatus,
                    error: execRes.error,
                    ...(nextStatus === "retry_pending"
                        ? {
                            maxRetryAttempts: this.maxRetryAttempts,
                            retryBaseDelayMs: this.retryBaseDelayMs,
                        }
                        : {}),
                });
                console.error("[CTRADER] EXEC FAILED", {
                    tradeSignalId: t.id,
                    error: execRes.error,
                    payload: execRes.payload,
                    nextStatus,
                });
            }
        }
        await this.db.updateTradeStatus(updates);
    }
    async executeClosePendingBatch(opts) {
        const batchSize = opts?.batchSize ?? Number(process.env.CTRADER_EXEC_BATCH_SIZE ?? 25);
        const healthy = await this.isHealthy(5000);
        if (!healthy)
            return;
        const closeSignals = await this.db.claimPendingCloseTrades(batchSize);
        //console.log(`[CTRADER] Executing batch of ${closeSignals.length} close trades`);
        if (!closeSignals.length)
            return;
        const updates = [];
        for (const signal of closeSignals) {
            //console.log("[CTRADER] Executing close trade signal ID:", signal.id);
            const closeRes = await this.exectuteCloseTradeApiCall(signal);
            //console.log("[CTRADER] Close trade signal result:", { signalId: signal.id, ...closeRes });
            if (closeRes.ok) {
                updates.push({ id: signal.id, status: "closed" });
            }
            else {
                const nextStatus = this.isTransientExecutionFailure(closeRes) ? "retry_pending_close" : "failed";
                updates.push({
                    id: signal.id,
                    status: nextStatus,
                    error: closeRes.error,
                    ...(nextStatus === "retry_pending_close"
                        ? {
                            maxRetryAttempts: this.maxRetryAttempts,
                            retryBaseDelayMs: this.retryBaseDelayMs,
                        }
                        : {}),
                });
                console.error("[CTRADER] CLOSE FAILED", {
                    signalId: signal.id,
                    error: closeRes.error,
                    payload: closeRes.payload,
                    nextStatus,
                });
            }
        }
        await this.db.updateTradeStatus(updates);
    }
    async completeOAuthAndVerifyByCTraderAccountId(ctraderAccountIdFromState, code) {
        const qr = data_source_1.default.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        try {
            const repo = qr.manager.getRepository(UserTradingAccount_1.UserTradingAccount);
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
            const broker = await qr.manager.getRepository(entity_1.Broker).findOne({ where: { code: "CT" } });
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
            await this.rebindAccountToActiveSubscription(qr, acc, broker);
            acc.accessToken = tokens.accessToken;
            acc.refreshToken = tokens.refreshToken ?? acc.refreshToken ?? "";
            acc.status = subscriberPlan_enum_1.TradingAccountStatus.VERIFIED;
            acc.lastVerifiedAt = new Date();
            await repo.save(acc);
            await qr.commitTransaction();
            return {
                ok: true,
                userId,
                rowId: acc.id,
                ctraderAccountId
            };
        }
        catch (e) {
            await qr.rollbackTransaction();
            return { ok: false, status: 500, error: "complete_oauth_failed", details: e?.message ?? String(e) };
        }
        finally {
            await qr.release();
        }
    }
}
exports.CTraderService = CTraderService;
