"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZebuService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const email_service_1 = require("../../../types/email.service");
const data_source_1 = __importDefault(require("../../../db/data-source"));
const zebu_db_1 = require("./zebu.db");
const constants_1 = require("../../../types/constants");
const subscriberPlan_enum_1 = require("../../subscriptionPlan/enums/subscriberPlan.enum");
const DEFAULT_NOREN_BASE_URL = "https://go.mynt.in/NorenWClientTP";
const DEFAULT_TIMEOUT_MS = 15000;
class ZebuService {
    constructor() {
        this.db = new zebu_db_1.ZebuDB();
    }
    asObject(value) {
        if (!value || typeof value !== "object" || Array.isArray(value))
            return {};
        return { ...value };
    }
    pickFirstString(...values) {
        for (const value of values) {
            if (value === undefined || value === null)
                continue;
            const normalized = String(value).trim();
            if (normalized)
                return normalized;
        }
        return undefined;
    }
    sha256(value) {
        return crypto_1.default.createHash("sha256").update(value).digest("hex");
    }
    normalizeNorenUid(raw) {
        const value = this.pickFirstString(raw);
        if (!value)
            return undefined;
        return value.replace(/_U$/i, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    }
    normalizeNorenBaseUrl(raw) {
        const candidate = this.pickFirstString(raw, DEFAULT_NOREN_BASE_URL);
        try {
            const url = new URL(candidate);
            const host = url.hostname.toLowerCase();
            if (["api.mynt.in", "mynt.in", "api.zebull.in", "zebull.in"].includes(host)) {
                return DEFAULT_NOREN_BASE_URL;
            }
            if (host === "go.mynt.in") {
                return `${url.protocol}//go.mynt.in/NorenWClientTP`;
            }
            const normalizedPath = url.pathname && url.pathname !== "/"
                ? url.pathname.replace(/NorenWClientWeb/gi, "NorenWClientTP").replace(/\/+$/, "")
                : "";
            return `${url.protocol}//${url.host}${normalizedPath}`;
        }
        catch {
            return DEFAULT_NOREN_BASE_URL;
        }
    }
    isNorenBase(baseUrl) {
        return /NorenWClient(?:TP|Web)/i.test(baseUrl) || /go\.mynt\.in/i.test(baseUrl);
    }
    requestTimeoutMs() {
        const raw = Number(process.env.ZEBU_REQUEST_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
        return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
    }
    resolveAppKey(uid) {
        const seed = this.pickFirstString(process.env.ZEBU_APPKEY_SEED, "S3cur3!d");
        return this.sha256(`${uid}|${seed}`);
    }
    buildAppKeyCandidates(uid, zebu, meta) {
        // Noren appkey = SHA256(uid|api_secret). Different setups store the secret
        // under different keys (appKey / apiSecret / apiKey), so try them all and
        // let the QuickAuth loop pick whichever Noren accepts.
        const secretSources = [
            zebu.appKey, zebu.apiSecret, zebu.apiKey,
            meta.appKey, meta.apiSecret, meta.apiKey,
            process.env.ZEBU_APP_KEY, process.env.ZEBU_API_SECRET,
        ];
        const candidates = new Set();
        for (const raw of secretSources) {
            const value = this.pickFirstString(raw);
            if (!value)
                continue;
            candidates.add(value);
            candidates.add(this.sha256(`${uid}|${value}`));
            const hexOnly = value.replace(/[^a-fA-F0-9]/g, "").toLowerCase();
            if (hexOnly.length === 64)
                candidates.add(hexOnly);
        }
        candidates.add(this.resolveAppKey(uid));
        return Array.from(candidates).filter(Boolean);
    }
    parseResponsePayload(text, contentType) {
        if (!text)
            return null;
        const ct = String(contentType ?? "");
        if (ct.includes("application/json")) {
            try {
                return JSON.parse(text);
            }
            catch {
                return text;
            }
        }
        try {
            return JSON.parse(text);
        }
        catch {
            return text;
        }
    }
    async fetchTextWithTimeout(url, init, timeoutMs) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, {
                ...init,
                signal: controller.signal,
            });
        }
        catch (error) {
            if (error?.name === "AbortError") {
                throw {
                    statusCode: constants_1.HttpStatusCode._APPLICATION_COMMUNICATION_FAILURE,
                    message: "zebu_request_timeout",
                    data: { url, timeoutMs },
                };
            }
            throw error;
        }
        finally {
            clearTimeout(timer);
        }
    }
    isMalformedNorenPayload(payload) {
        return payload === null || typeof payload === "string" || typeof payload !== "object";
    }
    isNotOk(payload) {
        return String(payload?.stat ?? "").toLowerCase() === "not_ok";
    }
    isOk(payload) {
        return String(payload?.stat ?? "").toLowerCase() === "ok";
    }
    isSessionExpiredPayload(payload) {
        const emsg = String(payload?.emsg ?? payload?.message ?? "").toLowerCase();
        return (emsg.includes("session expired") ||
            emsg.includes("invalid session key") ||
            emsg.includes("invalid jkey") ||
            emsg.includes("invalid token"));
    }
    isRetryablePayload(payload, phrases) {
        const emsg = String(payload?.emsg ?? payload?.message ?? "").toLowerCase();
        return phrases.some((phrase) => emsg.includes(phrase));
    }
    throwNorenFailure(action, status, payload, url, bodyMode) {
        if (this.isSessionExpiredPayload(payload)) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_GATEWAY,
                message: "zebu_session_expired",
                data: { action, status, payload, url, bodyMode },
            };
        }
        if (this.isMalformedNorenPayload(payload)) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_GATEWAY,
                message: "zebu_malformed_upstream_response",
                data: { action, status, payload, url, bodyMode },
            };
        }
        throw {
            statusCode: constants_1.HttpStatusCode._BAD_GATEWAY,
            message: action === "QuickAuth" ? "zebu_token_generation_failed" : "zebu_upstream_failed",
            data: { action, status, payload, url, bodyMode },
        };
    }
    async postNorenForm(baseUrl, action, jData, timeoutMs, jKey) {
        const url = `${baseUrl.replace(/\/+$/, "")}/${action}`;
        const jDataJson = JSON.stringify(jData);
        const variants = [
            {
                label: "urlencoded",
                body: `jData=${encodeURIComponent(jDataJson)}${jKey ? `&jKey=${encodeURIComponent(jKey)}` : ""}`,
            },
            {
                label: "raw-json",
                body: `jData=${jDataJson}${jKey ? `&jKey=${jKey}` : ""}`,
            },
        ];
        let lastPayload = null;
        let lastStatus = 0;
        let lastBodyMode = variants[0].label;
        for (const variant of variants) {
            const res = await this.fetchTextWithTimeout(url, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    accept: "application/json,text/plain,*/*",
                },
                body: variant.body,
            }, timeoutMs);
            const responseText = await res.text();
            lastStatus = res.status;
            lastBodyMode = variant.label;
            lastPayload = this.parseResponsePayload(responseText, res.headers.get("content-type"));
            if (res.ok && !this.isNotOk(lastPayload) && !this.isMalformedNorenPayload(lastPayload)) {
                return lastPayload;
            }
            if (this.isRetryablePayload(lastPayload, ["jdata is not valid json object"])) {
                continue;
            }
            this.throwNorenFailure(action, res.status, lastPayload, url, variant.label);
        }
        this.throwNorenFailure(action, lastStatus, lastPayload, url, lastBodyMode);
    }
    async requestTokenWithPasswordAndFactor2(account, password, factor2) {
        const meta = this.asObject(account?.accountMeta);
        const zebu = this.asObject(meta.zebu);
        const baseUrl = this.normalizeNorenBaseUrl(this.pickFirstString(zebu.baseUrl, process.env.ZEBU_BASE_URL));
        const rawUid = this.pickFirstString(zebu.uid, zebu.clientId, meta.uid, meta.clientId, process.env.ZEBU_UID, zebu.accountId, meta.accountId, account?.accountId);
        const uid = this.normalizeNorenUid(rawUid);
        const actid = this.normalizeNorenUid(this.pickFirstString(zebu.actid, zebu.accountId, meta.actid, meta.accountId, process.env.ZEBU_ACTID, uid));
        const vc = this.pickFirstString(zebu.vc, zebu.vendorCode, meta.vc, meta.vendorCode, process.env.ZEBU_VC, process.env.ZEBU_VENDOR_CODE, "NOREN_WEB");
        // Noren QuickAuth access type. MUST be "API" for programmatic token
        // generation — "WEB" is rejected with "Invalid Access Type".
        const source = this.pickFirstString(zebu.source, process.env.ZEBU_SOURCE, "API");
        const imei = this.pickFirstString(zebu.imei, process.env.ZEBU_IMEI, "abcd1234");
        const apkversion = this.pickFirstString(zebu.apkversion, process.env.ZEBU_APKVERSION, "1.0.0");
        if (!uid) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "zebu_credentials_missing" };
        }
        const appkeyCandidates = this.buildAppKeyCandidates(uid, zebu, meta);
        if (!appkeyCandidates.length) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "zebu_credentials_missing" };
        }
        let responseBody = null;
        let finalError = null;
        for (const appkey of appkeyCandidates) {
            const jData = {
                uid,
                pwd: this.sha256(password),
                factor2,
                imei,
                apkversion,
                vc,
                appkey,
                source,
            };
            console.info("[ZEBU][QuickAuth] attempt", {
                baseUrl,
                uid: jData.uid,
                vc: jData.vc,
                source: jData.source,
                appkey: `${String(jData.appkey).slice(0, 10)}...`,
                imei: jData.imei,
                apkversion: jData.apkversion,
                pwd: `sha256:${String(jData.pwd).slice(0, 8)}...`,
                factor2: `***${String(jData.factor2).slice(-2)}`,
            });
            try {
                responseBody = await this.postNorenForm(baseUrl, "QuickAuth", jData, this.requestTimeoutMs());
                if (this.isOk(responseBody))
                    break;
            }
            catch (error) {
                finalError = error;
                if (!this.isRetryablePayload(error?.data?.payload, ["invalid app key", "invalid user"])) {
                    throw error;
                }
            }
        }
        if (!this.isOk(responseBody)) {
            if (finalError)
                throw finalError;
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_GATEWAY,
                message: "zebu_token_generation_failed",
                data: { payload: responseBody },
            };
        }
        const accessToken = this.pickFirstString(responseBody?.susertoken, responseBody?.token, responseBody?.jwtToken);
        if (!accessToken) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_GATEWAY,
                message: "zebu_access_token_missing_in_response",
                data: { payload: responseBody },
            };
        }
        return {
            baseUrl: baseUrl.replace(/\/+$/, ""),
            uid,
            actid,
            clientId: uid,
            apiKey: this.pickFirstString(zebu.apiKey, meta.apiKey, process.env.ZEBU_API_KEY),
            apiSecret: this.pickFirstString(zebu.apiSecret, meta.apiSecret, process.env.ZEBU_API_SECRET),
            accessToken,
            refreshToken: undefined,
            expiresAt: undefined,
            exarr: responseBody?.exarr,
            prarr: responseBody?.prarr,
            orarr: responseBody?.orarr,
            raw: responseBody,
        };
    }
    getZebuConfigFromAccount(account) {
        const meta = this.asObject(account?.accountMeta);
        const zebu = this.asObject(meta?.zebu);
        const baseUrl = this.normalizeNorenBaseUrl(this.pickFirstString(zebu.baseUrl, process.env.ZEBU_BASE_URL));
        const accessToken = String(zebu.accessToken ?? account?.accessToken ?? "").trim();
        const apiKey = String(this.pickFirstString(zebu.apiKey, meta.apiKey, process.env.ZEBU_API_KEY) ?? "").trim() || undefined;
        const uid = this.normalizeNorenUid(this.pickFirstString(zebu.uid, zebu.clientId, meta.uid, meta.clientId, process.env.ZEBU_UID, zebu.accountId, meta.accountId, account?.accountId));
        const actid = this.normalizeNorenUid(this.pickFirstString(zebu.actid, zebu.accountId, meta.actid, meta.accountId, process.env.ZEBU_ACTID, uid));
        if (!accessToken) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "zebu_access_token_missing",
            };
        }
        return {
            baseUrl,
            accessToken,
            apiKey,
            uid,
            actid: actid ?? uid,
            timeoutMs: this.requestTimeoutMs(),
        };
    }
    mapOrderTypeForNoren(orderType) {
        const type = String(orderType ?? "MARKET").trim().toUpperCase().replace(/_/g, "-");
        if (["LIMIT", "LMT"].includes(type))
            return "LMT";
        if (["STOP", "SL-MKT", "SL-M", "STOP-MKT", "STOP-MARKET", "STOPLOSS-MARKET"].includes(type))
            return "SL-MKT";
        if (["SL-LMT", "SL", "STOP-LIMIT", "STOPLOSS-LIMIT"].includes(type))
            return "SL-LMT";
        return "MKT";
    }
    mapProductForNoren(product) {
        const p = String(product ?? "C").toUpperCase();
        if (["MIS", "I", "INTRADAY"].includes(p))
            return "I";
        if (["NRML", "M", "MARGIN"].includes(p))
            return "M";
        return "C";
    }
    normalizeExchange(raw) {
        const e = String(raw ?? "NSE").trim().toUpperCase();
        if (e === "NSE_DLY")
            return "NSE";
        if (e === "BSE_DLY")
            return "BSE";
        if (e === "NSE_EQ" || e === "NSECM")
            return "NSE";
        if (e === "BSE_EQ" || e === "BSECM")
            return "BSE";
        if (e === "NFO" || e === "NSE_FNO")
            return "NFO";
        if (e === "MCX" || e === "MCX_COMM")
            return "MCX";
        return e || "NSE";
    }
    normalizeNorenTradingSymbol(symbol, exchange) {
        let tsym = String(symbol ?? "").trim().toUpperCase();
        if (!tsym)
            return tsym;
        if (tsym.includes(":")) {
            tsym = tsym.split(":").pop() ?? tsym;
        }
        tsym = tsym.replace(/\s+/g, "");
        const exch = this.normalizeExchange(exchange);
        if ((exch === "NSE" || exch === "BSE") && !tsym.includes("-")) {
            tsym = `${tsym}-EQ`;
        }
        return tsym;
    }
    buildSymbolCandidates(symbol, exchange) {
        const exchangeForPlace = this.normalizeExchange(exchange);
        const rawSymbol = String(symbol ?? "").trim().toUpperCase();
        const normalizedSymbol = this.normalizeNorenTradingSymbol(rawSymbol, exchangeForPlace);
        const baseSymbol = rawSymbol.replace(/-EQ$/i, "");
        const indexRoots = new Set(["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX", "BANKEX"]);
        const isIndexRoot = indexRoots.has(baseSymbol);
        const rawToken = baseSymbol.includes(":") ? (baseSymbol.split(":").pop() ?? baseSymbol) : baseSymbol;
        const month = new Date().toLocaleString("en-US", { month: "short", timeZone: "Asia/Kolkata" }).toUpperCase();
        const nextMonthDate = new Date();
        nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
        const nextMonth = nextMonthDate.toLocaleString("en-US", { month: "short", timeZone: "Asia/Kolkata" }).toUpperCase();
        const futCandidates = isIndexRoot
            ? [`${baseSymbol} ${month} FUT`, `${baseSymbol}${month}FUT`, `${baseSymbol} ${nextMonth} FUT`, `${baseSymbol}${nextMonth}FUT`]
            : [];
        return {
            effectiveExchange: isIndexRoot ? "NFO" : exchangeForPlace,
            symbolsToTry: Array.from(new Set([
                isIndexRoot ? baseSymbol : normalizedSymbol,
                rawToken.replace(/\s+/g, ""),
                normalizedSymbol.replace(/-EQ$/i, ""),
                baseSymbol.replace(/\s+/g, ""),
                ...futCandidates,
            ].filter(Boolean))),
        };
    }
    extractOrderId(data) {
        const source = this.asObject(data?.data ?? data?.result ?? data);
        const value = this.pickFirstString(source.norenordno, source.orderNo, source.order_id, source.orderId, data?.norenordno, data?.result, data?.order_id, data?.orderId);
        return value ?? null;
    }
    buildPlaceOrderJData(config, body, symbol, exchange) {
        const quantity = Number(body?.quantity ?? 0);
        if (!Number.isFinite(quantity) || quantity <= 0) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "zebu_invalid_quantity" };
        }
        const price = body?.price != null ? Number(body.price) : 0;
        const triggerPrice = body?.triggerPrice != null ? Number(body.triggerPrice) : 0;
        const jData = {
            uid: config.uid,
            actid: config.actid ?? config.uid,
            exch: exchange,
            tsym: symbol,
            qty: String(quantity),
            prc: String(Number.isFinite(price) ? price : 0),
            trgprc: String(Number.isFinite(triggerPrice) ? triggerPrice : 0),
            trantype: String(body?.side ?? "BUY").toUpperCase().startsWith("S") ? "S" : "B",
            prd: this.mapProductForNoren(body?.product),
            prctyp: this.mapOrderTypeForNoren(body?.orderType),
            ret: String(body?.validity ?? "DAY").toUpperCase(),
            remarks: body?.tag ? String(body.tag).slice(0, 20) : undefined,
        };
        Object.keys(jData).forEach((k) => jData[k] === undefined && delete jData[k]);
        return jData;
    }
    buildModifyOrderJData(config, body) {
        const exchange = body.exchange ? this.normalizeExchange(body.exchange) : undefined;
        const symbol = body.symbol ? this.normalizeNorenTradingSymbol(body.symbol, exchange) : undefined;
        const jData = {
            uid: config.uid,
            actid: config.actid ?? config.uid,
            norenordno: String(body?.orderId ?? "").trim(),
            exch: exchange,
            tsym: symbol,
            qty: body?.quantity != null ? String(Number(body.quantity)) : undefined,
            prc: body?.price != null ? String(Number(body.price)) : undefined,
            trgprc: body?.triggerPrice != null ? String(Number(body.triggerPrice)) : undefined,
            prctyp: body?.orderType ? this.mapOrderTypeForNoren(body.orderType) : undefined,
            prd: body?.product ? this.mapProductForNoren(body.product) : undefined,
            ret: body?.validity ? String(body.validity).toUpperCase() : undefined,
        };
        Object.keys(jData).forEach((k) => jData[k] === undefined || jData[k] === "" ? delete jData[k] : undefined);
        return jData;
    }
    buildCancelOrderJData(config, body) {
        return {
            uid: config.uid,
            norenordno: String(body?.orderId ?? "").trim(),
        };
    }
    orderBookRows(payload) {
        if (Array.isArray(payload))
            return payload;
        if (Array.isArray(payload?.data))
            return payload.data;
        if (Array.isArray(payload?.orders))
            return payload.orders;
        return [];
    }
    async resolveModifyOrderPayload(config, payload) {
        if (payload.symbol && payload.exchange && payload.orderType) {
            return payload;
        }
        const orderBook = await this.zebuRequest(config, "GET", "orders");
        const row = this.orderBookRows(orderBook).find((item) => {
            const candidate = this.pickFirstString(item?.norenordno, item?.orderNo, item?.order_id, item?.orderId);
            return candidate === String(payload.orderId);
        });
        if (!row)
            return payload;
        return {
            ...payload,
            symbol: payload.symbol ?? row.tsym ?? row.tradingSymbol ?? row.symbol,
            exchange: payload.exchange ?? row.exch ?? row.exchange,
            orderType: payload.orderType ?? row.prctyp ?? row.orderType,
            product: payload.product ?? row.prd ?? row.product,
            validity: payload.validity ?? row.ret ?? row.validity,
            quantity: payload.quantity ?? (row.qty != null ? Number(row.qty) : undefined),
            price: payload.price ?? (row.prc != null ? Number(row.prc) : undefined),
            triggerPrice: payload.triggerPrice ?? (row.trgprc != null ? Number(row.trgprc) : undefined),
        };
    }
    async zebuRequest(config, method, path, body) {
        if (this.isNorenBase(config.baseUrl)) {
            if (!config.uid) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "zebu_uid_missing",
                };
            }
            if (path === "orders/place") {
                const { effectiveExchange, symbolsToTry } = this.buildSymbolCandidates(body?.symbol, body?.exchange);
                let lastError = null;
                console.info("[ZEBU] PlaceOrder symbol candidates", {
                    rawSymbol: body?.symbol,
                    exchange: effectiveExchange,
                    symbolsToTry,
                });
                for (const symbol of symbolsToTry) {
                    try {
                        const data = await this.postNorenForm(config.baseUrl, "PlaceOrder", this.buildPlaceOrderJData(config, body, symbol, effectiveExchange), config.timeoutMs, config.accessToken);
                        console.info("[ZEBU] PlaceOrder accepted", { triedSymbol: symbol });
                        return data;
                    }
                    catch (error) {
                        lastError = error;
                        if (this.isRetryablePayload(error?.data?.payload, ["invalid trading symbol"])) {
                            continue;
                        }
                        throw error;
                    }
                }
                throw lastError ?? {
                    statusCode: constants_1.HttpStatusCode._BAD_GATEWAY,
                    message: "zebu_upstream_failed",
                    data: { triedSymbols: symbolsToTry },
                };
            }
            if (path === "orders/modify") {
                return this.postNorenForm(config.baseUrl, "ModifyOrder", this.buildModifyOrderJData(config, body ?? {}), config.timeoutMs, config.accessToken);
            }
            if (path === "orders/cancel") {
                return this.postNorenForm(config.baseUrl, "CancelOrder", this.buildCancelOrderJData(config, body ?? {}), config.timeoutMs, config.accessToken);
            }
            const actionMap = {
                orders: "OrderBook",
                positions: "PositionBook",
                holdings: "Holdings",
                limits: "Limits",
                quotes: "GetQuotes",
            };
            const action = actionMap[path];
            if (!action) {
                throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "zebu_unknown_endpoint" };
            }
            const jData = { uid: config.uid };
            if (action !== "OrderBook" && action !== "GetQuotes" && config.actid)
                jData.actid = config.actid;
            // Noren Holdings requires a product code; default to CNC ("C").
            if (action === "Holdings")
                jData.prd = String(body?.product ?? "C");
            if (action === "GetQuotes") {
                jData.exch = this.normalizeExchange(body?.exchange);
                jData.token = String(body?.token ?? "").trim();
                if (!jData.token) {
                    throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "zebu_quote_token_missing" };
                }
            }
            return this.postNorenForm(config.baseUrl, action, jData, config.timeoutMs, config.accessToken);
        }
        const url = `${config.baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
        const res = await this.fetchTextWithTimeout(url, {
            method,
            headers: {
                "content-type": "application/json",
                accept: "application/json",
                Authorization: `Bearer ${config.accessToken}`,
                ...(config.apiKey ? { "x-api-key": config.apiKey } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        }, config.timeoutMs);
        const responseText = await res.text();
        const payload = this.parseResponsePayload(responseText, res.headers.get("content-type"));
        if (!res.ok) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_GATEWAY,
                message: "zebu_upstream_failed",
                data: { status: res.status, payload },
            };
        }
        return payload;
    }
    async saveAuthToken(payload) {
        const account = await this.db.getTradingAccountById(payload.userId, payload.tradingAccountId);
        if (!account) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
        }
        const existingMeta = this.asObject(account.accountMeta);
        const existingZebu = this.asObject(existingMeta.zebu);
        const now = new Date();
        const uid = this.normalizeNorenUid(this.pickFirstString(payload.uid, existingZebu.uid, existingZebu.clientId, existingMeta.uid, existingMeta.clientId));
        const actid = this.normalizeNorenUid(this.pickFirstString(payload.actid, existingZebu.actid, existingZebu.accountId, existingMeta.actid, existingMeta.accountId, uid));
        const nextMeta = {
            zebu: {
                ...existingZebu,
                accessToken: payload.accessToken,
                baseUrl: this.normalizeNorenBaseUrl(payload.baseUrl ?? existingZebu.baseUrl ?? process.env.ZEBU_BASE_URL),
                apiKey: payload.apiKey ?? existingZebu.apiKey,
                ...(uid ? { uid, clientId: uid } : {}),
                ...(actid ? { actid } : {}),
                lastVerifiedAt: now.toISOString(),
                updatedAt: now.toISOString(),
            },
        };
        if (account.status !== subscriberPlan_enum_1.TradingAccountStatus.VERIFIED) {
            account.status = subscriberPlan_enum_1.TradingAccountStatus.VERIFIED;
        }
        account.accessToken = payload.accessToken;
        account.lastVerifiedAt = now;
        await this.db.updateAccountMeta(account, nextMeta);
        return { ok: true };
    }
    async generateAndSaveTokenUsingTotp(payload) {
        const account = await this.db.getTradingAccountById(payload.userId, payload.tradingAccountId);
        if (!account) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
        }
        const factor2 = this.pickFirstString(payload.factor2, payload.totp);
        if (!factor2) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "factor2_required" };
        }
        const generated = await this.requestTokenWithPasswordAndFactor2(account, payload.password, factor2);
        const existingMeta = this.asObject(account.accountMeta);
        const existingZebu = this.asObject(existingMeta.zebu);
        const now = new Date();
        const nextMeta = {
            zebu: {
                ...existingZebu,
                uid: generated.uid,
                actid: generated.actid,
                clientId: generated.clientId,
                apiKey: generated.apiKey,
                apiSecret: generated.apiSecret,
                baseUrl: generated.baseUrl,
                accessToken: generated.accessToken,
                refreshToken: generated.refreshToken,
                tokenExpiresAt: generated.expiresAt,
                exarr: generated.exarr,
                prarr: generated.prarr,
                orarr: generated.orarr,
                lastVerifiedAt: now.toISOString(),
                updatedAt: now.toISOString(),
            },
        };
        if (account.status !== subscriberPlan_enum_1.TradingAccountStatus.VERIFIED) {
            account.status = subscriberPlan_enum_1.TradingAccountStatus.VERIFIED;
        }
        account.accessToken = generated.accessToken;
        account.lastVerifiedAt = now;
        if (generated.refreshToken) {
            account.refreshToken = generated.refreshToken;
        }
        await this.db.updateAccountMeta(account, nextMeta);
        return {
            ok: true,
            tradingAccountId: payload.tradingAccountId,
            tokenStored: true,
            expiresAt: generated.expiresAt ?? null,
        };
    }
    /** Format an ISO date (2024-03-28) into Noren expiry "28MAR24". */
    formatNorenExpiry(expiry) {
        if (!expiry)
            return null;
        const d = new Date(expiry);
        if (Number.isNaN(d.getTime()))
            return null;
        const dd = String(d.getUTCDate()).padStart(2, "0");
        const mon = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
        const yy = String(d.getUTCFullYear()).slice(-2);
        return `${dd}${mon}${yy}`;
    }
    /**
     * Resolve the exchange + Noren trading symbol from the explicit instrument
     * fields on the signal. Precedence: explicit tradingSymbol → built F&O symbol
     * → equity (-EQ). Falls back to the legacy symbol/exchange heuristic when the
     * new fields are absent (backward compatible).
     */
    resolveZebuInstrument(signal) {
        const instrumentType = String(signal.instrumentType ?? "").toUpperCase();
        let exchange = this.normalizeExchange(signal.exchange ? String(signal.exchange) : undefined);
        const explicitTsym = signal.tradingSymbol
            ? String(signal.tradingSymbol).trim().toUpperCase()
            : null;
        // Derivatives must route to NFO/BFO/MCX, never NSE/BSE cash.
        const isDerivative = instrumentType === "FUTURES" || instrumentType === "OPTIONS";
        if (isDerivative && (exchange === "NSE" || exchange === "BSE")) {
            exchange = exchange === "BSE" ? "BFO" : "NFO";
        }
        if (explicitTsym) {
            return { exchange, symbol: explicitTsym };
        }
        if (instrumentType === "OPTIONS" && (signal.brokerInstrumentId || signal.instrumentToken)) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "zebu_enriched_option_requires_trading_symbol",
            };
        }
        if (isDerivative) {
            const underlying = String(signal.underlying ?? signal.symbol ?? "").trim().toUpperCase();
            const exp = this.formatNorenExpiry(signal.expiry);
            if (underlying && exp) {
                if (instrumentType === "FUTURES") {
                    return { exchange, symbol: `${underlying}${exp}F` };
                }
                const opt = String(signal.optionType ?? "").toUpperCase() === "PE" ? "P" : "C";
                const strike = signal.strike != null ? String(Number(signal.strike)) : "";
                return { exchange, symbol: `${underlying}${exp}${opt}${strike}` };
            }
            // missing expiry/underlying → pass raw symbol through on the derivative exchange
            return { exchange, symbol: String(signal.symbol).trim().toUpperCase().replace(/\s+/g, "") };
        }
        // EQUITY (default / legacy)
        return { exchange, symbol: this.normalizeNorenTradingSymbol(String(signal.symbol), exchange) };
    }
    buildOrderFromSignal(signal) {
        const { exchange, symbol } = this.resolveZebuInstrument(signal);
        return {
            symbol,
            exchange,
            side: String(signal.action).toUpperCase() === "SELL" ? "SELL" : "BUY",
            quantity: Number(signal.volume) || 1,
            orderType: signal.orderType ?? "MARKET",
            product: signal.product ?? undefined,
            price: signal.limitPrice != null ? Number(signal.limitPrice) : signal.price != null ? Number(signal.price) : undefined,
            triggerPrice: signal.stopPrice != null ? Number(signal.stopPrice) : undefined,
            clientOrderId: `signal_${signal.id}`,
        };
    }
    async ensureSchema() {
        await this.db.ensureSchema();
    }
    toNumber(value) {
        if (value === undefined || value === null || value === "")
            return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    toPositiveNumber(value) {
        const parsed = this.toNumber(value);
        return parsed !== null && parsed > 0 ? parsed : null;
    }
    toOrderId(value) {
        const text = String(value ?? "").trim();
        return text ? text : null;
    }
    hasProtectionFields(signal) {
        return [
            signal.stopLoss,
            signal.takeProfit,
            signal.stopLossDistance,
            signal.takeProfitDistance,
            signal.breakEvenActivationDistance,
            signal.breakEvenOffsetDistance,
            signal.trailingStopLossDistance,
        ].some((value) => value !== undefined && value !== null);
    }
    queueTradeNotification(signal, params) {
        const lookup = this.db?.getUserEmailForSignal;
        if (typeof lookup !== "function")
            return;
        Promise.resolve()
            .then(() => lookup.call(this.db, signal.id))
            .then((user) => {
            if (!user?.email)
                return;
            return (0, email_service_1.sendTradeNotificationEmail)({
                ...params,
                userEmail: user.email,
                userName: user.name ?? null,
            });
        })
            .catch((error) => {
            console.warn("[ZEBU] trade notification skipped", {
                tradeSignalId: signal.id,
                error: error?.message ?? String(error),
            });
        });
    }
    extractRowOrderId(row) {
        return this.pickFirstString(row?.norenordno, row?.orderNo, row?.order_id, row?.orderId) ?? null;
    }
    findOrderRow(orderBook, orderId) {
        const target = this.toOrderId(orderId);
        if (!target)
            return null;
        return this.orderBookRows(orderBook).find((row) => this.extractRowOrderId(row) === target) ?? null;
    }
    normalizeOrderStatus(row) {
        return String(row?.status ?? row?.ordstatus ?? row?.orderStatus ?? "")
            .trim()
            .toLowerCase()
            .replace(/[\s_-]+/g, "");
    }
    isFilledOrder(row) {
        const status = this.normalizeOrderStatus(row);
        if (["complete", "completed", "filled", "traded", "executed"].includes(status))
            return true;
        const filled = this.toNumber(row?.fillshares ?? row?.filledQuantity ?? row?.filledQty);
        const qty = this.toNumber(row?.qty ?? row?.quantity);
        return filled !== null && qty !== null && qty > 0 && filled >= qty;
    }
    isRejectedOrder(row) {
        const status = this.normalizeOrderStatus(row);
        return ["rejected", "cancelled", "canceled"].includes(status);
    }
    isOpenOrder(row) {
        if (!row)
            return false;
        return !this.isFilledOrder(row) && !this.isRejectedOrder(row);
    }
    rowFillPrice(row) {
        return this.toPositiveNumber(row?.avgprc ?? row?.averagePrice ?? row?.average_price ?? row?.prc);
    }
    rowTickSize(row) {
        return this.toPositiveNumber(row?.ti ?? row?.tickSize ?? row?.tick_size);
    }
    rowToken(row) {
        return this.pickFirstString(row?.token, row?.instrumentToken, row?.instrument_token) ?? null;
    }
    decimalsForTick(tickSize) {
        const fixed = tickSize.toString();
        if (!fixed.includes("."))
            return 0;
        return Math.min(8, fixed.split(".")[1].replace(/0+$/, "").length);
    }
    roundToTick(price, tickSize) {
        const tick = Number(tickSize ?? 0);
        if (!Number.isFinite(tick) || tick <= 0)
            return Number(price.toFixed(6));
        const rounded = Math.round(price / tick) * tick;
        return Number(rounded.toFixed(this.decimalsForTick(tick)));
    }
    oppositeSide(side) {
        return side === "BUY" ? "SELL" : "BUY";
    }
    protectionTargetPrice(monitor, entryPrice, tickSize) {
        const absolute = this.toPositiveNumber(monitor.takeProfit);
        if (absolute !== null)
            return this.roundToTick(absolute, tickSize);
        const distance = this.toPositiveNumber(monitor.takeProfitDistance);
        if (distance === null)
            return null;
        const raw = monitor.side === "BUY" ? entryPrice + distance : entryPrice - distance;
        return raw > 0 ? this.roundToTick(raw, tickSize) : null;
    }
    protectionStopPrice(monitor, entryPrice, tickSize) {
        const absolute = this.toPositiveNumber(monitor.stopLoss);
        if (absolute !== null)
            return this.roundToTick(absolute, tickSize);
        const distance = this.toPositiveNumber(monitor.stopLossDistance);
        if (distance === null)
            return null;
        const raw = monitor.side === "BUY" ? entryPrice - distance : entryPrice + distance;
        return raw > 0 ? this.roundToTick(raw, tickSize) : null;
    }
    buildMonitorFromSignal(signal, order, entryOrderId) {
        return {
            tradeSignalId: signal.id,
            userId: signal.userId,
            tradingAccountId: signal.tradingAccountId,
            symbol: order.symbol,
            exchange: order.exchange ?? "NSE",
            side: order.side,
            entryRef: signal.entryRef ?? null,
            quantity: order.quantity,
            product: order.product ?? null,
            validity: order.validity ?? "DAY",
            entryOrderId,
            stopOrderId: null,
            targetOrderId: null,
            token: signal.instrumentToken ?? null,
            tickSize: signal.tickSize != null ? Number(signal.tickSize) : null,
            stopLoss: signal.stopLoss != null ? Number(signal.stopLoss) : null,
            takeProfit: signal.takeProfit != null ? Number(signal.takeProfit) : null,
            stopLossDistance: signal.stopLossDistance != null ? Number(signal.stopLossDistance) : null,
            takeProfitDistance: signal.takeProfitDistance != null ? Number(signal.takeProfitDistance) : null,
            breakEvenActivationDistance: signal.breakEvenActivationDistance != null ? Number(signal.breakEvenActivationDistance) : null,
            breakEvenOffsetDistance: signal.breakEvenOffsetDistance != null ? Number(signal.breakEvenOffsetDistance) : null,
            trailingStopLossDistance: signal.trailingStopLossDistance != null ? Number(signal.trailingStopLossDistance) : null,
            monitorStatus: "pending_fill",
            lastError: null,
        };
    }
    buildChildOrderPayload(monitor, args) {
        const side = this.oppositeSide(monitor.side);
        const payload = {
            symbol: monitor.symbol,
            exchange: monitor.exchange,
            side,
            quantity: Number(monitor.quantity),
            product: monitor.product ?? undefined,
            validity: monitor.validity ?? "DAY",
            tag: `zebu_${args.kind}_${monitor.tradeSignalId}`,
        };
        if (args.kind === "target") {
            payload.orderType = "LIMIT";
            payload.price = args.price;
        }
        else {
            payload.orderType = "SL-MKT";
            payload.price = 0;
            payload.triggerPrice = args.price;
        }
        Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
        return payload;
    }
    async placeProtectionChild(config, monitor, args) {
        const data = await this.zebuRequest(config, "POST", "orders/place", this.buildChildOrderPayload(monitor, args));
        const orderId = this.extractOrderId(data);
        if (!orderId) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_GATEWAY, message: "zebu_child_order_id_missing", data };
        }
        return orderId;
    }
    async cancelIfOpen(config, orderBook, orderId) {
        const row = this.findOrderRow(orderBook, orderId);
        if (!orderId || (row && !this.isOpenOrder(row)))
            return;
        await this.zebuRequest(config, "POST", "orders/cancel", { orderId });
    }
    async fetchQuoteLtp(config, monitor) {
        const token = this.pickFirstString(monitor.token);
        if (!token)
            return null;
        const quote = await this.zebuRequest(config, "GET", "quotes", {
            exchange: monitor.exchange,
            token,
        });
        return this.toPositiveNumber(quote?.lp ?? quote?.ltp ?? quote?.lastPrice);
    }
    computeNextManagedStop(monitor, ltp, entryPrice, tickSize) {
        const existingBest = this.toPositiveNumber(monitor.bestPrice) ?? entryPrice;
        const bestPrice = monitor.side === "BUY" ? Math.max(existingBest, ltp) : Math.min(existingBest, ltp);
        const favorableDistance = monitor.side === "BUY" ? bestPrice - entryPrice : entryPrice - bestPrice;
        const current = this.toPositiveNumber(monitor.currentStopPrice);
        const candidates = [];
        const breakEvenActivation = this.toPositiveNumber(monitor.breakEvenActivationDistance);
        if (breakEvenActivation !== null && favorableDistance >= breakEvenActivation) {
            const offset = this.toNumber(monitor.breakEvenOffsetDistance) ?? 0;
            candidates.push(monitor.side === "BUY" ? entryPrice + offset : entryPrice - offset);
        }
        const trailingDistance = this.toPositiveNumber(monitor.trailingStopLossDistance);
        if (trailingDistance !== null && favorableDistance >= trailingDistance) {
            candidates.push(monitor.side === "BUY" ? bestPrice - trailingDistance : bestPrice + trailingDistance);
        }
        const validCandidates = candidates
            .filter((price) => Number.isFinite(price) && price > 0)
            .map((price) => this.roundToTick(price, tickSize));
        if (!validCandidates.length)
            return { bestPrice, nextStop: null };
        const nextStop = monitor.side === "BUY"
            ? Math.max(...validCandidates)
            : Math.min(...validCandidates);
        if (current !== null) {
            if (monitor.side === "BUY" && nextStop <= current)
                return { bestPrice, nextStop: null };
            if (monitor.side === "SELL" && nextStop >= current)
                return { bestPrice, nextStop: null };
        }
        return { bestPrice, nextStop };
    }
    async placeOrder(req) {
        const account = await this.db.getTradingAccountById(req.userId, req.tradingAccountId);
        if (!account) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
        }
        const cfg = this.getZebuConfigFromAccount(account);
        const payload = {
            symbol: this.normalizeNorenTradingSymbol(req.order.symbol, req.order.exchange),
            exchange: this.normalizeExchange(req.order.exchange),
            side: req.order.side,
            quantity: req.order.quantity,
            orderType: req.order.orderType,
            product: req.order.product,
            validity: req.order.validity,
            price: req.order.price,
            triggerPrice: req.order.triggerPrice,
            tag: req.order.clientOrderId ? String(req.order.clientOrderId).slice(0, 20) : undefined,
        };
        Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
        const data = await this.zebuRequest(cfg, "POST", "orders/place", payload);
        const orderId = this.extractOrderId(data);
        return { orderId, raw: data };
    }
    async modifyOrder(req) {
        const account = await this.db.getTradingAccountById(req.userId, req.tradingAccountId);
        if (!account) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
        }
        const cfg = this.getZebuConfigFromAccount(account);
        const payload = { orderId: req.orderId };
        if (req.symbol)
            payload.symbol = req.symbol;
        if (req.exchange)
            payload.exchange = req.exchange;
        if (req.orderType)
            payload.orderType = req.orderType;
        if (req.product)
            payload.product = req.product;
        if (typeof req.quantity === "number")
            payload.quantity = req.quantity;
        if (typeof req.price === "number")
            payload.price = req.price;
        if (typeof req.triggerPrice === "number")
            payload.triggerPrice = req.triggerPrice;
        if (req.validity)
            payload.validity = req.validity;
        const resolvedPayload = await this.resolveModifyOrderPayload(cfg, payload);
        const data = await this.zebuRequest(cfg, "POST", "orders/modify", resolvedPayload);
        return { orderId: req.orderId, raw: data };
    }
    async cancelOrder(req) {
        const account = await this.db.getTradingAccountById(req.userId, req.tradingAccountId);
        if (!account) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
        }
        const cfg = this.getZebuConfigFromAccount(account);
        const data = await this.zebuRequest(cfg, "POST", "orders/cancel", { orderId: req.orderId });
        return { orderId: req.orderId, raw: data };
    }
    async getOrders(userId, tradingAccountId) {
        const account = await this.db.getTradingAccountById(userId, tradingAccountId);
        if (!account) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
        }
        const cfg = this.getZebuConfigFromAccount(account);
        return this.zebuRequest(cfg, "GET", "orders");
    }
    async getPositions(userId, tradingAccountId) {
        const account = await this.db.getTradingAccountById(userId, tradingAccountId);
        if (!account) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
        }
        const cfg = this.getZebuConfigFromAccount(account);
        return this.zebuRequest(cfg, "GET", "positions");
    }
    async getHoldings(userId, tradingAccountId) {
        const account = await this.db.getTradingAccountById(userId, tradingAccountId);
        if (!account) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
        }
        const cfg = this.getZebuConfigFromAccount(account);
        return this.zebuRequest(cfg, "GET", "holdings");
    }
    async getFunds(userId, tradingAccountId) {
        const account = await this.db.getTradingAccountById(userId, tradingAccountId);
        if (!account) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
        }
        const cfg = this.getZebuConfigFromAccount(account);
        const raw = await this.zebuRequest(cfg, "GET", "limits") ?? {};
        return {
            ok: true,
            availableCash: Number(raw.cash ?? raw.cashavail ?? raw.avlcash ?? 0),
            marginUsed: Number(raw.marginused ?? raw.marginusd ?? raw.payin ?? 0),
            collateral: Number(raw.collateralvalue ?? raw.collateral ?? 0),
            totalFunds: Number(raw.cash ?? 0) + Number(raw.collateralvalue ?? 0),
            raw,
        };
    }
    /** Auto-close all intraday (MIS/I) positions before 15:30 NSE close */
    async closeAllIntradayPositions() {
        // Get all active protection monitors with product = "I" (intraday)
        const monitors = await data_source_1.default.query(`SELECT id, trade_signal_id, user_id, trading_account_id, symbol, exchange, quantity, side
			 FROM zebu_protection_monitors
			 WHERE status = 'active'
			   AND product = 'I'`);
        let closed = 0, failed = 0;
        for (const m of monitors) {
            try {
                const account = await this.db.getTradingAccountById(Number(m.user_id), Number(m.trading_account_id));
                if (!account) {
                    failed++;
                    continue;
                }
                const cfg = this.getZebuConfigFromAccount(account);
                const closeSide = String(m.side).toUpperCase() === "BUY" ? "SELL" : "BUY";
                await this.zebuRequest(cfg, "POST", "orders/place", {
                    tsym: m.symbol,
                    exch: m.exchange ?? "NSE",
                    trantype: closeSide,
                    qty: String(m.quantity),
                    prctyp: "MKT",
                    prd: "I",
                    ret: "DAY",
                    remarks: `AUTO_CLOSE_INTRADAY_${m.id}`,
                });
                await data_source_1.default.query(`UPDATE zebu_protection_monitors SET status = 'auto_closed', updated_at = NOW() WHERE id = $1`, [m.id]);
                closed++;
            }
            catch (e) {
                console.error("[ZEBU] Auto-close intraday monitor failed", m.id, e?.message);
                failed++;
            }
        }
        return { attempted: monitors.length, closed, failed };
    }
    async activateProtectionFromFill(config, monitor, entryRow) {
        const entryPrice = this.rowFillPrice(entryRow) ?? this.toPositiveNumber(monitor.entryPrice);
        if (entryPrice === null) {
            await this.db.updateProtectionMonitor(monitor.id, { lastError: "zebu_entry_fill_price_missing" });
            return { activated: false, error: null };
        }
        const tickSize = this.rowTickSize(entryRow) ?? this.toPositiveNumber(monitor.tickSize) ?? 0.05;
        const token = this.rowToken(entryRow) ?? monitor.token ?? null;
        const patch = {
            entryPrice,
            tickSize,
            token,
            bestPrice: entryPrice,
            lastError: null,
        };
        try {
            const targetPrice = this.protectionTargetPrice(monitor, entryPrice, tickSize);
            if (targetPrice !== null && !monitor.targetOrderId) {
                patch.targetOrderId = await this.placeProtectionChild(config, monitor, {
                    kind: "target",
                    price: targetPrice,
                });
            }
            const stopPrice = this.protectionStopPrice(monitor, entryPrice, tickSize);
            if (stopPrice !== null && !monitor.stopOrderId) {
                patch.stopOrderId = await this.placeProtectionChild(config, monitor, {
                    kind: "stop",
                    price: stopPrice,
                });
                patch.currentStopPrice = stopPrice;
            }
            patch.monitorStatus = "active";
            await this.db.updateProtectionMonitor(monitor.id, patch);
            await this.db.updateTradeStatus([{ id: monitor.tradeSignalId, status: "completed" }]);
            return { activated: true, error: null };
        }
        catch (error) {
            const message = error?.message ?? "zebu_protection_setup_failed";
            await this.db.markProtectionFailed(monitor, message);
            await this.db.updateTradeStatus([{ id: monitor.tradeSignalId, status: "failed", error: message }]);
            return { activated: false, error: message };
        }
    }
    async processPendingFillMonitor(config, monitor) {
        const orderBook = await this.zebuRequest(config, "GET", "orders");
        const entryRow = this.findOrderRow(orderBook, monitor.entryOrderId);
        if (!entryRow) {
            await this.db.updateProtectionMonitor(monitor.id, { lastError: "zebu_entry_order_not_found" });
            return { status: "waiting" };
        }
        if (this.isRejectedOrder(entryRow)) {
            const reason = this.pickFirstString(entryRow?.rejreason, entryRow?.emsg, entryRow?.status) ?? "zebu_entry_order_not_filled";
            await this.db.markProtectionFailed(monitor, reason);
            await this.db.updateTradeStatus([{ id: monitor.tradeSignalId, status: "failed", error: reason }]);
            return { status: "failed", error: reason };
        }
        if (!this.isFilledOrder(entryRow)) {
            await this.db.updateProtectionMonitor(monitor.id, { lastError: null });
            return { status: "waiting" };
        }
        return this.activateProtectionFromFill(config, monitor, entryRow);
    }
    async updateManagedStop(config, monitor, orderBook) {
        const entryPrice = this.toPositiveNumber(monitor.entryPrice);
        if (entryPrice === null)
            return;
        const ltp = await this.fetchQuoteLtp(config, monitor);
        if (ltp === null)
            return;
        const tickSize = this.toPositiveNumber(monitor.tickSize) ?? 0.05;
        const { bestPrice, nextStop } = this.computeNextManagedStop(monitor, ltp, entryPrice, tickSize);
        const patch = { bestPrice, lastError: null };
        if (nextStop === null) {
            await this.db.updateProtectionMonitor(monitor.id, patch);
            return;
        }
        const stopRow = this.findOrderRow(orderBook, monitor.stopOrderId);
        if (monitor.stopOrderId && stopRow && this.isOpenOrder(stopRow)) {
            await this.zebuRequest(config, "POST", "orders/modify", {
                orderId: monitor.stopOrderId,
                symbol: monitor.symbol,
                exchange: monitor.exchange,
                orderType: "SL-MKT",
                product: monitor.product ?? undefined,
                validity: monitor.validity ?? "DAY",
                quantity: Number(monitor.quantity),
                price: 0,
                triggerPrice: nextStop,
            });
            patch.currentStopPrice = nextStop;
            await this.db.updateProtectionMonitor(monitor.id, patch);
            return;
        }
        const newStopOrderId = await this.placeProtectionChild(config, monitor, {
            kind: "stop",
            price: nextStop,
        });
        patch.stopOrderId = newStopOrderId;
        patch.currentStopPrice = nextStop;
        await this.db.updateProtectionMonitor(monitor.id, patch);
    }
    async processActiveMonitor(config, monitor) {
        const orderBook = await this.zebuRequest(config, "GET", "orders");
        const targetRow = this.findOrderRow(orderBook, monitor.targetOrderId);
        const stopRow = this.findOrderRow(orderBook, monitor.stopOrderId);
        if (targetRow && this.isFilledOrder(targetRow)) {
            await this.cancelIfOpen(config, orderBook, monitor.stopOrderId);
            await this.db.updateProtectionMonitor(monitor.id, {
                monitorStatus: "completed",
                lastError: null,
            });
            return { status: "completed", exit: "target" };
        }
        if (stopRow && this.isFilledOrder(stopRow)) {
            await this.cancelIfOpen(config, orderBook, monitor.targetOrderId);
            await this.db.updateProtectionMonitor(monitor.id, {
                monitorStatus: "completed",
                lastError: null,
            });
            return { status: "completed", exit: "stop" };
        }
        try {
            await this.updateManagedStop(config, monitor, orderBook);
            return { status: "active" };
        }
        catch (error) {
            const message = error?.message ?? "zebu_managed_stop_update_failed";
            await this.db.updateProtectionMonitor(monitor.id, { lastError: message });
            return { status: "error", error: message };
        }
    }
    positionRows(payload) {
        if (Array.isArray(payload))
            return payload;
        if (Array.isArray(payload?.data))
            return payload.data;
        if (Array.isArray(payload?.positions))
            return payload.positions;
        return [];
    }
    positionQuantity(row) {
        const direct = this.toNumber(row?.netqty ??
            row?.netQty ??
            row?.net_quantity ??
            row?.netQuantity ??
            row?.quantity ??
            row?.qty);
        if (direct !== null)
            return Math.abs(direct);
        const buyQty = this.toNumber(row?.daybuyqty ?? row?.buyqty ?? row?.buyQty) ?? 0;
        const sellQty = this.toNumber(row?.daysellqty ?? row?.sellqty ?? row?.sellQty) ?? 0;
        return Math.abs(buyQty - sellQty);
    }
    findPositionRow(positionsPayload, symbol, exchange) {
        const normalizedSymbol = this.normalizeNorenTradingSymbol(symbol, exchange);
        const rawSymbol = normalizedSymbol.replace(/-EQ$/i, "");
        const normalizedExchange = this.normalizeExchange(exchange);
        return this.positionRows(positionsPayload).find((row) => {
            const rowExchange = this.normalizeExchange(row?.exch ?? row?.exchange);
            const rowSymbol = this.normalizeNorenTradingSymbol(row?.tsym ?? row?.tradingSymbol ?? row?.symbol, rowExchange);
            const rowRaw = rowSymbol.replace(/-EQ$/i, "");
            return rowExchange === normalizedExchange && (rowSymbol === normalizedSymbol || rowRaw === rawSymbol);
        }) ?? null;
    }
    async executeCloseSignal(config, signal) {
        const monitor = await this.db.findProtectionMonitorByTradeSignalId(signal.id);
        const orderBook = await this.zebuRequest(config, "GET", "orders");
        if (monitor) {
            await this.cancelIfOpen(config, orderBook, monitor.targetOrderId);
            await this.cancelIfOpen(config, orderBook, monitor.stopOrderId);
            const entryRow = this.findOrderRow(orderBook, monitor.entryOrderId);
            if (entryRow && this.isOpenOrder(entryRow)) {
                await this.cancelIfOpen(config, orderBook, monitor.entryOrderId);
                await this.db.updateProtectionMonitor(monitor.id, { monitorStatus: "completed", lastError: null });
                return { closed: true, brokerOrderId: monitor.entryOrderId };
            }
        }
        const order = this.buildOrderFromSignal(signal);
        const positions = await this.zebuRequest(config, "GET", "positions");
        const row = this.findPositionRow(positions, order.symbol, order.exchange ?? "NSE");
        const remainingQty = row ? this.positionQuantity(row) : 0;
        if (!row || remainingQty <= 0) {
            if (monitor) {
                await this.db.updateProtectionMonitor(monitor.id, { monitorStatus: "completed", lastError: null });
            }
            return { closed: true, brokerOrderId: monitor?.entryOrderId ?? signal.brokerOrderId ?? signal.orderId ?? null };
        }
        const data = await this.zebuRequest(config, "POST", "orders/place", {
            symbol: order.symbol,
            exchange: order.exchange,
            side: this.oppositeSide(order.side),
            quantity: remainingQty,
            orderType: "MARKET",
            product: order.product,
            validity: order.validity,
            tag: `zebu_close_${signal.id}`,
        });
        const brokerOrderId = this.extractOrderId(data);
        if (monitor) {
            await this.db.updateProtectionMonitor(monitor.id, { monitorStatus: "completed", lastError: null });
        }
        return { closed: true, brokerOrderId };
    }
    async executeProtectionBatch(opts) {
        const batchSize = opts?.batchSize ?? Number(process.env.ZEBU_PROTECTION_BATCH_SIZE ?? process.env.ZEBU_EXEC_BATCH_SIZE ?? 25);
        const monitors = await this.db.claimProtectionMonitors(batchSize);
        if (!monitors.length)
            return { ok: true, processed: 0 };
        let completed = 0;
        let failed = 0;
        let active = 0;
        for (const monitor of monitors) {
            try {
                const account = await this.db.getTradingAccountById(Number(monitor.userId), Number(monitor.tradingAccountId));
                if (!account) {
                    await this.db.markProtectionFailed(monitor, "trading_account_not_found");
                    failed += 1;
                    continue;
                }
                const cfg = this.getZebuConfigFromAccount(account);
                const status = String(monitor.monitorStatus);
                const result = status === "pending_fill"
                    ? await this.processPendingFillMonitor(cfg, monitor)
                    : await this.processActiveMonitor(cfg, monitor);
                if (result?.status === "failed")
                    failed += 1;
                else if (result?.status === "completed" || result?.activated)
                    completed += 1;
                else
                    active += 1;
            }
            catch (error) {
                failed += 1;
                const message = error?.message ?? "zebu_protection_worker_failed";
                await this.db.markProtectionFailed(monitor, message);
            }
        }
        return { ok: true, processed: monitors.length, completed, active, failed };
    }
    async executeClosePendingBatch(opts) {
        const batchSize = opts?.batchSize ?? Number(process.env.ZEBU_EXEC_BATCH_SIZE ?? 25);
        const trades = await this.db.claimPendingCloseTrades(batchSize);
        if (!trades.length)
            return { ok: true, processed: 0 };
        const updates = [];
        for (const t of trades) {
            try {
                if (!t.tradingAccount) {
                    updates.push({ id: t.id, status: "failed", error: "missing_trading_account" });
                    continue;
                }
                const cfg = this.getZebuConfigFromAccount(t.tradingAccount);
                const result = await this.executeCloseSignal(cfg, t);
                updates.push({ id: t.id, status: "closed", brokerOrderId: result.brokerOrderId ?? undefined });
                this.queueTradeNotification(t, {
                    event: "closed",
                    symbol: t.symbol,
                    exchange: String(t.exchange ?? ""),
                    side: String(t.action),
                    quantity: Number(t.volume),
                    broker: String(t.tradingAccount?.broker?.code ?? "ZEBU"),
                    tradeSignalId: t.id,
                });
            }
            catch (error) {
                updates.push({ id: t.id, status: "failed", error: error?.message ?? String(error) });
            }
        }
        await this.db.updateTradeStatus(updates);
        return {
            ok: true,
            processed: trades.length,
            closed: updates.filter((u) => u.status === "closed").length,
            failed: updates.filter((u) => u.status === "failed").length,
        };
    }
    async executePendingBatch(opts) {
        const batchSize = opts?.batchSize ?? Number(process.env.ZEBU_EXEC_BATCH_SIZE ?? 25);
        const trades = await this.db.claimPendingTrades(batchSize);
        if (!trades.length)
            return { ok: true, processed: 0 };
        const updates = [];
        for (const t of trades) {
            try {
                if (!t.tradingAccount) {
                    updates.push({ id: t.id, status: "failed", error: "missing_trading_account" });
                    continue;
                }
                const cfg = this.getZebuConfigFromAccount(t.tradingAccount);
                const order = this.buildOrderFromSignal(t);
                const payload = {
                    symbol: order.symbol,
                    exchange: order.exchange,
                    side: order.side,
                    quantity: order.quantity,
                    orderType: order.orderType,
                    product: order.product,
                    validity: order.validity,
                    price: order.price,
                    triggerPrice: order.triggerPrice,
                    tag: order.clientOrderId,
                };
                Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
                const data = await this.zebuRequest(cfg, "POST", "orders/place", payload);
                const brokerOrderId = this.extractOrderId(data);
                if (!brokerOrderId) {
                    throw { statusCode: constants_1.HttpStatusCode._BAD_GATEWAY, message: "zebu_order_id_missing", data };
                }
                console.info("[ZEBU] EXEC OK", {
                    tradeSignalId: t.id,
                    symbol: payload.symbol,
                    exchange: payload.exchange,
                    quantity: payload.quantity,
                    brokerOrderId,
                });
                if (this.hasProtectionFields(t)) {
                    await this.db.createProtectionMonitor(this.buildMonitorFromSignal(t, order, brokerOrderId));
                    updates.push({ id: t.id, status: "in_progress", brokerOrderId });
                }
                else {
                    updates.push({ id: t.id, status: "executed", brokerOrderId });
                }
                this.queueTradeNotification(t, {
                    event: "executed",
                    symbol: t.symbol,
                    exchange: String(t.exchange ?? ""),
                    side: String(t.action),
                    quantity: Number(t.volume),
                    price: Number(order.price ?? 0) || null,
                    brokerOrderId: String(brokerOrderId),
                    broker: String(t.tradingAccount?.broker?.code ?? "ZEBU"),
                    tradeSignalId: t.id,
                });
            }
            catch (e) {
                console.error("[ZEBU] EXEC FAILED", {
                    tradeSignalId: t.id,
                    error: e?.message ?? String(e),
                    payload: e?.data,
                });
                updates.push({ id: t.id, status: "failed", error: e?.message ?? String(e) });
                this.queueTradeNotification(t, {
                    event: "failed",
                    symbol: t.symbol,
                    exchange: String(t.exchange ?? ""),
                    side: String(t.action),
                    quantity: Number(t.volume),
                    errorMessage: e?.message ?? String(e),
                    broker: String(t.tradingAccount?.broker?.code ?? "ZEBU"),
                    tradeSignalId: t.id,
                });
            }
        }
        await this.db.updateTradeStatus(updates);
        const executed = updates.filter((u) => u.status === "executed").length;
        const failed = updates.filter((u) => u.status === "failed").length;
        console.info("[ZEBU] EXEC BATCH SUMMARY", {
            processed: trades.length,
            executed,
            failed,
        });
        return { ok: true, processed: trades.length, executed, failed };
    }
}
exports.ZebuService = ZebuService;
