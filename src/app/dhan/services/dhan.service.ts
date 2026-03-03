import { DhanDB } from "./dhan.db";
import { HttpStatusCode } from "../../../types/constants";
import { TradingAccountStatus } from "../../subscriptionPlan/enums/subscriberPlan.enum";
import {
	DhanAuthPayload,
	DhanGenerateTokenRequest,
	DhanBatchRequest,
	DhanCancelOrderRequest,
	DhanModifyOrderRequest,
	DhanPlaceOrderRequest,
	DhanOrderPayload,
} from "../interfaces/dhan";
import { TradeSignal } from "../../../entity/TradeSignals";

type DhanConfig = {
	baseUrl: string;
	accessToken: string;
	apiKey?: string;
};

export class DhanService {
	private db = new DhanDB();

	private asObject(value: unknown): Record<string, any> {
		if (!value || typeof value !== "object" || Array.isArray(value)) return {};
		return { ...(value as Record<string, any>) };
	}

	private pickFirstString(...values: unknown[]): string | undefined {
		for (const value of values) {
			if (value === undefined || value === null) continue;
			const normalized = String(value).trim();
			if (normalized) return normalized;
		}
		return undefined;
	}

	private extractTokenPayload(payload: any): {
		accessToken?: string;
		refreshToken?: string;
		expiresAt?: string;
	} {
		const source = this.asObject(payload?.data ?? payload?.result ?? payload);
		const accessToken = this.pickFirstString(
			source.accessToken,
			source.access_token,
			source.token,
			source.jwtToken,
			source.jwt_token
		);
		const refreshToken = this.pickFirstString(
			source.refreshToken,
			source.refresh_token
		);
		const expiresAt = this.pickFirstString(
			source.expiresAt,
			source.expiry,
			source.expires_at,
			source.tokenExpiry,
			source.token_expiry
		);

		return { accessToken, refreshToken, expiresAt };
	}

	private async requestTokenWithTotp(account: any, totp: string, baseUrlOverride?: string) {
		const meta = this.asObject(account?.accountMeta);
		const dhan = this.asObject(meta.dhan);

		const baseUrl = this.pickFirstString(baseUrlOverride, dhan.baseUrl, process.env.DHAN_BASE_URL);
		const authPath = this.pickFirstString(process.env.DHAN_TOKEN_PATH, "auth/token")!;
		const clientId = this.pickFirstString(dhan.clientId, meta.clientId, meta.accountId, account?.accountId);
		const apiKey = this.pickFirstString(dhan.apiKey, meta.apiKey, meta.vendorCode, process.env.DHAN_API_KEY);
		const apiSecret = this.pickFirstString(dhan.apiSecret, dhan.appKey, meta.apiSecret, meta.appKey);

		if (!baseUrl) {
			throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "dhan_base_url_missing" };
		}
		if (!clientId || !apiKey || !apiSecret) {
			throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "dhan_credentials_missing" };
		}

		const url = `${baseUrl.replace(/\/+$/, "")}/${authPath.replace(/^\/+/, "")}`;
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json",
			},
			body: JSON.stringify({
				clientId,
				apiKey,
				apiSecret,
				totp,
			}),
		});

		const ct = res.headers.get("content-type") ?? "";
		let responseBody: any = null;
		try {
			responseBody = ct.includes("application/json") ? await res.json() : await res.text();
		} catch {
			responseBody = null;
		}

		if (!res.ok) {
			throw {
				statusCode: HttpStatusCode._BAD_GATEWAY,
				message: "dhan_token_generation_failed",
				data: { status: res.status, payload: responseBody },
			};
		}

		const tokenData = this.extractTokenPayload(responseBody);
		if (!tokenData.accessToken) {
			throw {
				statusCode: HttpStatusCode._BAD_GATEWAY,
				message: "dhan_access_token_missing_in_response",
				data: { payload: responseBody },
			};
		}

		return {
			baseUrl,
			clientId,
			apiKey,
			apiSecret,
			...tokenData,
			raw: responseBody,
		};
	}

	private getDhanConfigFromAccount(account: any): DhanConfig {
		const meta = account?.accountMeta ?? {};
		const dhan = meta?.dhan ?? {};

		const baseUrl = String(dhan.baseUrl ?? process.env.DHAN_BASE_URL ?? "").trim();
		const accessToken = String(dhan.accessToken ?? account?.accessToken ?? "").trim();
		const apiKey = String(dhan.apiKey ?? process.env.DHAN_API_KEY ?? "").trim() || undefined;

		if (!baseUrl) {
			throw {
				statusCode: HttpStatusCode._BAD_REQUEST,
				message: "dhan_base_url_missing",
			};
		}

		if (!accessToken) {
			throw {
				statusCode: HttpStatusCode._BAD_REQUEST,
				message: "dhan_access_token_missing",
			};
		}

		return { baseUrl, accessToken, apiKey };
	}

	private async dhanRequest(
		config: DhanConfig,
		method: "GET" | "POST",
		path: string,
		body?: any
	) {
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
		let payload: any = null;
		try {
			payload = ct.includes("application/json") ? await res.json() : await res.text();
		} catch {
			payload = null;
		}

		if (!res.ok) {
			throw {
				statusCode: HttpStatusCode._BAD_GATEWAY,
				message: "dhan_upstream_failed",
				data: { status: res.status, payload },
			};
		}

		return payload;
	}

	async saveAuthToken(payload: DhanAuthPayload) {
		const account = await this.db.getTradingAccountById(payload.userId, payload.tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}
		const existingMeta = this.asObject(account.accountMeta);
		const existingDhan = this.asObject(existingMeta.dhan);

		const nextMeta = {
			dhan: {
				...existingDhan,
				accessToken: payload.accessToken,
				baseUrl: payload.baseUrl ?? existingDhan.baseUrl,
				apiKey: payload.apiKey ?? existingDhan.apiKey,
				updatedAt: new Date().toISOString(),
			},
		};

		if (account.status !== TradingAccountStatus.VERIFIED) {
			account.status = TradingAccountStatus.VERIFIED;
		}

		await this.db.updateAccountMeta(account, nextMeta);

		return { ok: true };
	}

	async generateAndSaveTokenUsingTotp(payload: DhanGenerateTokenRequest) {
		const account = await this.db.getTradingAccountById(payload.userId, payload.tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}

		const generated = await this.requestTokenWithTotp(account, payload.totp, payload.baseUrl);
		const existingMeta = this.asObject(account.accountMeta);
		const existingDhan = this.asObject(existingMeta.dhan);

		const nextMeta = {
			dhan: {
				...existingDhan,
				clientId: generated.clientId,
				apiKey: generated.apiKey,
				apiSecret: generated.apiSecret,
				baseUrl: generated.baseUrl,
				accessToken: generated.accessToken,
				refreshToken: generated.refreshToken,
				tokenExpiresAt: generated.expiresAt,
				updatedAt: new Date().toISOString(),
			},
		};

		if (account.status !== TradingAccountStatus.VERIFIED) {
			account.status = TradingAccountStatus.VERIFIED;
		}

		await this.db.updateAccountMeta(account, nextMeta);

		return {
			ok: true,
			tradingAccountId: payload.tradingAccountId,
			tokenStored: true,
			expiresAt: generated.expiresAt ?? null,
		};
	}

	private buildOrderFromSignal(signal: TradeSignal): DhanOrderPayload {
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

	async placeOrder(req: DhanPlaceOrderRequest) {
		const account = await this.db.getTradingAccountById(req.userId, req.tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}

		const cfg = this.getDhanConfigFromAccount(account);

		const payload: Record<string, any> = {
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

		const data = await this.dhanRequest(cfg, "POST", "orders/place", payload);

		const orderId =
			data?.data?.order_id || data?.data?.orderId || data?.order_id || data?.orderId || null;

		return { orderId: orderId ? String(orderId) : null, raw: data };
	}

	async modifyOrder(req: DhanModifyOrderRequest) {
		const account = await this.db.getTradingAccountById(req.userId, req.tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}

		const cfg = this.getDhanConfigFromAccount(account);

		const payload: Record<string, any> = { orderId: req.orderId };
		if (typeof req.quantity === "number") payload.quantity = req.quantity;
		if (typeof req.price === "number") payload.price = req.price;
		if (typeof req.triggerPrice === "number") payload.triggerPrice = req.triggerPrice;
		if (req.validity) payload.validity = req.validity;

		const data = await this.dhanRequest(cfg, "POST", "orders/modify", payload);
		return { orderId: req.orderId, raw: data };
	}

	async cancelOrder(req: DhanCancelOrderRequest) {
		const account = await this.db.getTradingAccountById(req.userId, req.tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}

		const cfg = this.getDhanConfigFromAccount(account);
		const data = await this.dhanRequest(cfg, "POST", "orders/cancel", { orderId: req.orderId });
		return { orderId: req.orderId, raw: data };
	}

	async getOrders(userId: number, tradingAccountId: number) {
		const account = await this.db.getTradingAccountById(userId, tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}

		const cfg = this.getDhanConfigFromAccount(account);
		const data = await this.dhanRequest(cfg, "GET", "orders");
		return data;
	}

	async getPositions(userId: number, tradingAccountId: number) {
		const account = await this.db.getTradingAccountById(userId, tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}

		const cfg = this.getDhanConfigFromAccount(account);
		const data = await this.dhanRequest(cfg, "GET", "positions");
		return data;
	}

	async getHoldings(userId: number, tradingAccountId: number) {
		const account = await this.db.getTradingAccountById(userId, tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}

		const cfg = this.getDhanConfigFromAccount(account);
		const data = await this.dhanRequest(cfg, "GET", "holdings");
		return data;
	}

	async executePendingBatch(opts?: DhanBatchRequest) {
		const batchSize = opts?.batchSize ?? Number(process.env.DHAN_EXEC_BATCH_SIZE ?? 25);
		const trades = await this.db.claimPendingTrades(batchSize);
		if (!trades.length) return { ok: true, processed: 0 };

		const updates: { id: number; status: string; error?: string }[] = [];

		for (const t of trades) {
			try {
				if (!t.tradingAccount) {
					updates.push({ id: t.id, status: "failed", error: "missing_trading_account" });
					continue;
				}

				const cfg = this.getDhanConfigFromAccount(t.tradingAccount as any);
				const order = this.buildOrderFromSignal(t);

				const payload: Record<string, any> = {
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

				await this.dhanRequest(cfg, "POST", "orders/place", payload);
				updates.push({ id: t.id, status: "executed" });
			} catch (e: any) {
				updates.push({ id: t.id, status: "failed", error: e?.message ?? String(e) });
			}
		}

		await this.db.updateTradeStatus(updates);
		return { ok: true, processed: trades.length };
	}
}
