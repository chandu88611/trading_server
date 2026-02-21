"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZebuService = void 0;
const zebu_db_1 = require("./zebu.db");
const constants_1 = require("../../../types/constants");
const subscriberPlan_enum_1 = require("../../subscriptionPlan/enums/subscriberPlan.enum");
class ZebuService {
    constructor() {
        this.db = new zebu_db_1.ZebuDB();
    }
    getZebuConfigFromAccount(account) {
        const meta = account?.accountMeta ?? {};
        const zebu = meta?.zebu ?? {};
        const baseUrl = String(zebu.baseUrl ?? process.env.ZEBU_BASE_URL ?? "").trim();
        const accessToken = String(zebu.accessToken ?? account?.accessToken ?? "").trim();
        const apiKey = String(zebu.apiKey ?? process.env.ZEBU_API_KEY ?? "").trim() || undefined;
        if (!baseUrl) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "zebu_base_url_missing",
            };
        }
        if (!accessToken) {
            throw {
                statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "zebu_access_token_missing",
            };
        }
        return { baseUrl, accessToken, apiKey };
    }
    async zebuRequest(config, method, path, body) {
        const url = `${config.baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
        const res = await fetch(url, {
            method,
            headers: {
                "content-type": "application/json",
                accept: "application/json",
                Authorization: `Bearer ${config.accessToken}`,
                ...(config.apiKey ? { "x-api-key": config.apiKey } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        const ct = res.headers.get("content-type") ?? "";
        let payload = null;
        try {
            payload = ct.includes("application/json") ? await res.json() : await res.text();
        }
        catch {
            payload = null;
        }
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
        const nextMeta = {
            zebu: {
                accessToken: payload.accessToken,
                baseUrl: payload.baseUrl ?? account.accountMeta?.zebu?.baseUrl,
                apiKey: payload.apiKey ?? account.accountMeta?.zebu?.apiKey,
                updatedAt: new Date().toISOString(),
            },
        };
        if (account.status !== subscriberPlan_enum_1.TradingAccountStatus.VERIFIED) {
            account.status = subscriberPlan_enum_1.TradingAccountStatus.VERIFIED;
        }
        await this.db.updateAccountMeta(account, nextMeta);
        return { ok: true };
    }
    buildOrderFromSignal(signal) {
        return {
            symbol: String(signal.symbol),
            exchange: signal.exchange ? String(signal.exchange) : undefined,
            side: String(signal.action).toUpperCase() === "SELL" ? "SELL" : "BUY",
            quantity: Number(signal.volume) || 1,
            orderType: "MARKET",
            price: signal.price != null ? Number(signal.price) : undefined,
            clientOrderId: `signal_${signal.id}`,
        };
    }
    async placeOrder(req) {
        const account = await this.db.getTradingAccountById(req.userId, req.tradingAccountId);
        if (!account) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
        }
        const cfg = this.getZebuConfigFromAccount(account);
        const payload = {
            symbol: req.order.symbol,
            exchange: req.order.exchange,
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
        const orderId = data?.data?.order_id || data?.data?.orderId || data?.order_id || data?.orderId || null;
        return { orderId: orderId ? String(orderId) : null, raw: data };
    }
    async modifyOrder(req) {
        const account = await this.db.getTradingAccountById(req.userId, req.tradingAccountId);
        if (!account) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
        }
        const cfg = this.getZebuConfigFromAccount(account);
        const payload = { orderId: req.orderId };
        if (typeof req.quantity === "number")
            payload.quantity = req.quantity;
        if (typeof req.price === "number")
            payload.price = req.price;
        if (typeof req.triggerPrice === "number")
            payload.triggerPrice = req.triggerPrice;
        if (req.validity)
            payload.validity = req.validity;
        const data = await this.zebuRequest(cfg, "POST", "orders/modify", payload);
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
        const data = await this.zebuRequest(cfg, "GET", "orders");
        return data;
    }
    async getPositions(userId, tradingAccountId) {
        const account = await this.db.getTradingAccountById(userId, tradingAccountId);
        if (!account) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
        }
        const cfg = this.getZebuConfigFromAccount(account);
        const data = await this.zebuRequest(cfg, "GET", "positions");
        return data;
    }
    async getHoldings(userId, tradingAccountId) {
        const account = await this.db.getTradingAccountById(userId, tradingAccountId);
        if (!account) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
        }
        const cfg = this.getZebuConfigFromAccount(account);
        const data = await this.zebuRequest(cfg, "GET", "holdings");
        return data;
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
                await this.zebuRequest(cfg, "POST", "orders/place", payload);
                updates.push({ id: t.id, status: "executed" });
            }
            catch (e) {
                updates.push({ id: t.id, status: "failed", error: e?.message ?? String(e) });
            }
        }
        await this.db.updateTradeStatus(updates);
        return { ok: true, processed: trades.length };
    }
}
exports.ZebuService = ZebuService;
