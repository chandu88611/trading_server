import crypto from "crypto";
import { DeltaDB } from "./delta.db";
import {
	DeltaAuthPayload,
	DeltaBatchRequest,
	DeltaCancelOrderRequest,
	DeltaModifyOrderRequest,
	DeltaOrderPayload,
	DeltaPlaceOrderRequest,
	DeltaPublicOrderbookRequest,
	DeltaPublicTickerRequest,
} from "../interfaces/delta";

type DeltaCredentials = {
	apiKey: string;
	apiSecret: string;
	baseUrl: string;
};

type DeltaSignedRequestInput = {
	account: any;
	method: "GET" | "POST" | "PUT" | "DELETE";
	path: string;
	payload?: Record<string, any>;
	query?: Record<string, any>;
};

type DeltaProduct = {
	id: number;
	symbol?: string;
	contract_value?: string | number;
	tick_size?: string | number;
	description?: string;
	underlying_asset?: any;
	quoting_asset?: any;
	settling_asset?: any;
	[key: string]: any;
};

export class DeltaService {
	private db = new DeltaDB();
	private productsCache?: {
		expiresAt: number;
		products: DeltaProduct[];
	};

	private defaultBaseUrl() {
		return process.env.DELTA_BASE_URL ?? "https://api.delta.exchange/v2";
	}

	private normalizeBrokerCode(account: any) {
		return String(account?.broker?.code ?? "").trim().toUpperCase();
	}

	private normalizeBrokerName(account: any) {
		return String(account?.broker?.name ?? "").trim();
	}

	private assertDeltaAccount(account: any) {
		const brokerCode = this.normalizeBrokerCode(account);
		const brokerName = this.normalizeBrokerName(account);

		if (
			brokerCode !== "DELTA" &&
			brokerCode !== "DELTA_EXCHANGE" &&
			brokerName !== "Delta Exchange"
		) {
			throw {
				statusCode: 400,
				message: "invalid_broker_account",
			};
		}

		return brokerCode || brokerName || "DELTA";
	}

	private async getAccountOrThrow(userId: number, tradingAccountId: number) {
		const account = await this.db.getTradingAccountById(userId, tradingAccountId);

		if (!account) {
			throw {
				statusCode: 404,
				message: "trading_account_not_found",
			};
		}

		this.assertDeltaAccount(account);

		return account;
	}

	private getCredentials(account: any): DeltaCredentials {
		const meta = account?.accountMeta ?? {};
		const deltaMeta = meta.delta ?? {};

		const apiKey =
			deltaMeta.apiKey ??
			meta.deltaApiKey ??
			meta.apiKey ??
			null;

		const apiSecret =
			deltaMeta.apiSecret ??
			meta.deltaApiSecret ??
			meta.apiSecret ??
			null;

		const baseUrl =
			deltaMeta.baseUrl ??
			meta.deltaBaseUrl ??
			meta.baseUrl ??
			this.defaultBaseUrl();

		if (!apiKey || !apiSecret) {
			throw {
				statusCode: 400,
				message: "delta_credentials_not_found",
			};
		}

		return {
			apiKey: String(apiKey),
			apiSecret: String(apiSecret),
			baseUrl: String(baseUrl).replace(/\/+$/, ""),
		};
	}

	private safeErrorMessage(e: any, fallback: string) {
		return (
			e?.data?.message ??
			e?.data?.payload?.message ??
			e?.data?.error?.message ??
			e?.data?.error ??
			e?.message ??
			fallback
		);
	}

	private toQueryString(query?: Record<string, any>) {
		if (!query) return "";

		const params = new URLSearchParams();

		Object.entries(query).forEach(([key, value]) => {
			if (value === undefined || value === null || value === "") return;
			params.set(key, String(value));
		});

		const text = params.toString();

		return text ? `?${text}` : "";
	}

	private normalizePath(path: string) {
		if (!path.startsWith("/")) return `/${path}`;
		return path;
	}

	private buildSignature(args: {
		method: string;
		timestamp: string;
		path: string;
		queryString: string;
		body: string;
		apiSecret: string;
	}) {
		const signaturePayload =
			args.method.toUpperCase() +
			args.timestamp +
			args.path +
			args.queryString +
			args.body;

		return crypto
			.createHmac("sha256", args.apiSecret)
			.update(signaturePayload)
			.digest("hex");
	}

	private async publicRequest(path: string, query?: Record<string, any>) {
		const baseUrl = this.defaultBaseUrl().replace(/\/+$/, "");
		const normalizedPath = this.normalizePath(path);
		const queryString = this.toQueryString(query);
		const url = `${baseUrl}${normalizedPath}${queryString}`;

		const res = await globalThis.fetch(url, {
			method: "GET",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
		});

		const text = await res.text();
		let responsePayload: any = null;

		try {
			responsePayload = text ? JSON.parse(text) : null;
		} catch {
			responsePayload = text;
		}

		if (!res.ok) {
			throw {
				statusCode: 502,
				message: "delta_public_api_failed",
				data: {
					path: normalizedPath,
					status: res.status,
					payload: responsePayload,
				},
			};
		}

		return responsePayload;
	}

	private async signedRequest(input: DeltaSignedRequestInput) {
		const credentials = this.getCredentials(input.account);
		const method = input.method.toUpperCase();
		const path = this.normalizePath(input.path);
		const queryString = this.toQueryString(input.query);
		const body =
			method === "GET" || method === "DELETE"
				? ""
				: JSON.stringify(input.payload ?? {});
		const timestamp = Math.floor(Date.now() / 1000).toString();

		const signature = this.buildSignature({
			method,
			timestamp,
			path,
			queryString,
			body,
			apiSecret: credentials.apiSecret,
		});

		const url = `${credentials.baseUrl}${path}${queryString}`;

		const res = await globalThis.fetch(url, {
			method,
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
				"api-key": credentials.apiKey,
				signature,
				timestamp,
				"User-Agent": "tradebro-delta-api",
			},
			body: body ? body : undefined,
		});

		const text = await res.text();
		let responsePayload: any = null;

		try {
			responsePayload = text ? JSON.parse(text) : null;
		} catch {
			responsePayload = text;
		}

		console.info("[DELTA] API RESPONSE", {
			path,
			method,
			responseStatus: res.status,
			ok: res.ok,
		});

		if (!res.ok) {
			throw {
				statusCode: 502,
				message: "delta_api_failed",
				data: {
					path,
					method,
					status: res.status,
					payload: responsePayload,
				},
			};
		}

		return responsePayload;
	}

	private extractResult(response: any) {
		return response?.result ?? response?.data ?? response;
	}

	private extractOrderId(response: any) {
		const result = this.extractResult(response);

		return (
			result?.id ??
			result?.order_id ??
			result?.orderId ??
			response?.id ??
			response?.order_id ??
			null
		);
	}

	private normalizeSide(side: string) {
		const value = String(side ?? "").trim().toUpperCase();

		if (value !== "BUY" && value !== "SELL") {
			throw {
				statusCode: 400,
				message: "invalid_order_side",
			};
		}

		return value;
	}

	private normalizeDeltaSide(side: string) {
		const normalized = this.normalizeSide(side);
		return normalized === "BUY" ? "buy" : "sell";
	}

	private normalizeOrderType(orderType?: string) {
		const value = String(orderType ?? "MARKET").trim().toUpperCase();

		if (value === "MARKET" || value === "MARKET_ORDER") return "market_order";
		if (value === "LIMIT" || value === "LIMIT_ORDER") return "limit_order";

		return value.toLowerCase();
	}

	private normalizeSymbol(symbol: string) {
		return String(symbol ?? "")
			.trim()
			.toUpperCase()
			.replace(/[^A-Z0-9_/-]/g, "");
	}

	private async getProducts(): Promise<DeltaProduct[]> {
		const now = Date.now();

		if (this.productsCache && this.productsCache.expiresAt > now) {
			return this.productsCache.products;
		}

		const response = await this.publicRequest("/products");
		const products = Array.isArray(response?.result)
			? response.result
			: Array.isArray(response)
				? response
				: [];

		this.productsCache = {
			expiresAt: now + Number(process.env.DELTA_PRODUCTS_CACHE_TTL_MS ?? 5 * 60 * 1000),
			products,
		};

		return products;
	}

	private productSearchKeys(product: DeltaProduct) {
		const keys = [
			product.symbol,
			product.description,
			product.product_symbol,
			product.contract_type,
			product.underlying_asset?.symbol,
			product.underlying_asset?.name,
			product.quoting_asset?.symbol,
			product.settling_asset?.symbol,
		];

		return keys
			.map((v) => this.normalizeSymbol(String(v ?? "")))
			.filter(Boolean);
	}

	private async resolveProductId(order: DeltaOrderPayload): Promise<number> {
		if (order.productId && Number.isFinite(Number(order.productId))) {
			return Number(order.productId);
		}

		const requestedSymbol = this.normalizeSymbol(order.symbol);

		if (!requestedSymbol) {
			throw {
				statusCode: 400,
				message: "delta_symbol_required",
			};
		}

		const products = await this.getProducts();

		const exact = products.find((p) =>
			this.productSearchKeys(p).includes(requestedSymbol)
		);

		if (exact?.id) {
			return Number(exact.id);
		}

		const compactRequested = requestedSymbol.replace(/[-_/]/g, "");

		const loose = products.find((p) => {
			const keys = this.productSearchKeys(p).map((k) => k.replace(/[-_/]/g, ""));
			return keys.includes(compactRequested);
		});

		if (loose?.id) {
			return Number(loose.id);
		}

		const contains = products.find((p) => {
			const keys = this.productSearchKeys(p).map((k) => k.replace(/[-_/]/g, ""));
			return keys.some((k) => k.includes(compactRequested) || compactRequested.includes(k));
		});

		if (contains?.id) {
			return Number(contains.id);
		}

		throw {
			statusCode: 400,
			message: "delta_product_not_found",
			data: {
				symbol: order.symbol,
			},
		};
	}

	private buildOrderFromSignal(signal: any): DeltaOrderPayload {
		const symbol =
			signal?.symbol ??
			signal?.ticker ??
			signal?.instrument ??
			signal?.tradingSymbol ??
			signal?.rawPayload?.symbol ??
			signal?.rawPayload?.ticker;

		const side =
			signal?.action ??
			signal?.side ??
			signal?.transactionType ??
			signal?.rawPayload?.action ??
			signal?.rawPayload?.side;

		const quantity =
			signal?.quantity ??
			signal?.volume ??
			signal?.qty ??
			signal?.rawPayload?.quantity ??
			signal?.rawPayload?.volume;

		const orderType =
			signal?.orderType ??
			signal?.order_type ??
			signal?.rawPayload?.orderType ??
			"MARKET";

		const price =
			signal?.price ??
			signal?.limitPrice ??
			signal?.rawPayload?.price ??
			undefined;

		const productId =
			signal?.productId ??
			signal?.product_id ??
			signal?.rawPayload?.productId ??
			signal?.rawPayload?.product_id ??
			undefined;

		return {
			symbol: this.normalizeSymbol(String(symbol ?? "")),
			side: this.normalizeSide(String(side ?? "")) as "BUY" | "SELL",
			quantity: Number(quantity),
			orderType: String(orderType ?? "MARKET"),
			price: price !== undefined && price !== null ? Number(price) : undefined,
			productId: productId !== undefined && productId !== null ? Number(productId) : undefined,
			clientOrderId: `signal_${signal.id}`,
			reduceOnly: Boolean(signal?.reduceOnly ?? signal?.rawPayload?.reduceOnly ?? false),
		};
	}

	private async buildDeltaOrderPayload(order: DeltaOrderPayload) {
		const productId = await this.resolveProductId(order);
		const side = this.normalizeDeltaSide(order.side);
		const orderType = this.normalizeOrderType(order.orderType);
		const size = Number(order.quantity);
		const price =
			order.price !== undefined && order.price !== null
				? Number(order.price)
				: undefined;

		if (!Number.isFinite(size) || size <= 0) {
			throw {
				statusCode: 400,
				message: "invalid_quantity",
			};
		}

		if (orderType === "limit_order" && (!Number.isFinite(price) || Number(price) <= 0)) {
			throw {
				statusCode: 400,
				message: "price_required_for_limit_order",
			};
		}

		const payload: Record<string, any> = {
			product_id: productId,
			side,
			size,
			order_type: orderType,
			reduce_only: Boolean(order.reduceOnly ?? false),
		};

		if (orderType === "limit_order") {
			payload.limit_price = String(price);
		}

		if (order.clientOrderId) {
			payload.client_order_id = String(order.clientOrderId);
		}

		return payload;
	}

	async saveAuthToken(payload: DeltaAuthPayload) {
		const account = await this.getAccountOrThrow(
			payload.userId,
			payload.tradingAccountId
		);

		const broker = this.assertDeltaAccount(account);
		const connectedAt = new Date().toISOString();
		const baseUrl =
			payload.baseUrl ??
			process.env.DELTA_BASE_URL ??
			"https://api.delta.exchange/v2";

		await this.db.updateAccountMeta(account, {
			delta: {
				...((account.accountMeta ?? {}).delta ?? {}),
				apiKey: payload.apiKey,
				apiSecret: payload.apiSecret,
				baseUrl,
				connectedAt,
				verifiedAt: null,
				lastVerifyStatus: null,
				lastVerifyError: null,
			},

			// Backward compatibility.
			deltaApiKey: payload.apiKey,
			deltaApiSecret: payload.apiSecret,
			deltaBaseUrl: baseUrl,
			deltaConnectedAt: connectedAt,
		});

		return {
			tradingAccountId: payload.tradingAccountId,
			broker,
			hasApiKey: true,
			hasApiSecret: true,
			baseUrl,
			connectedAt,
			isReady: true,
		};
	}

	async getAuthTokenStatus(userId: number, tradingAccountId: number) {
		const account = await this.getAccountOrThrow(userId, tradingAccountId);
		const broker = this.assertDeltaAccount(account);

		const meta = account.accountMeta ?? {};
		const deltaMeta = meta.delta ?? {};

		const apiKey =
			deltaMeta.apiKey ??
			meta.deltaApiKey ??
			meta.apiKey ??
			null;

		const apiSecret =
			deltaMeta.apiSecret ??
			meta.deltaApiSecret ??
			meta.apiSecret ??
			null;

		const baseUrl =
			deltaMeta.baseUrl ??
			meta.deltaBaseUrl ??
			meta.baseUrl ??
			this.defaultBaseUrl();

		return {
			tradingAccountId,
			broker,
			hasApiKey: Boolean(apiKey),
			hasApiSecret: Boolean(apiSecret),
			baseUrl,
			connectedAt: deltaMeta.connectedAt ?? meta.deltaConnectedAt ?? null,
			verifiedAt: deltaMeta.verifiedAt ?? meta.deltaVerifiedAt ?? null,
			lastVerifyStatus:
				deltaMeta.lastVerifyStatus ??
				meta.deltaLastVerifyStatus ??
				null,
			isReady: Boolean(apiKey && apiSecret),
		};
	}

	async verifyAuthToken(userId: number, tradingAccountId: number) {
		const account = await this.getAccountOrThrow(userId, tradingAccountId);
		const status = await this.getAuthTokenStatus(userId, tradingAccountId);

		if (!status.isReady) {
			return {
				valid: false,
				tradingAccountId,
				broker: status.broker,
				checkedAt: new Date().toISOString(),
				error: "delta_credentials_not_found",
			};
		}

		try {
			await this.getPositions(userId, tradingAccountId);

			const verifiedAt = new Date().toISOString();

			await this.db.updateAccountMeta(account, {
				delta: {
					...((account.accountMeta ?? {}).delta ?? {}),
					verifiedAt,
					lastVerifyStatus: "success",
					lastVerifyError: null,
				},
				deltaVerifiedAt: verifiedAt,
				deltaLastVerifyStatus: "success",
				deltaLastVerifyError: null,
			});

			return {
				valid: true,
				tradingAccountId,
				broker: status.broker,
				checkedAt: verifiedAt,
			};
		} catch (e: any) {
			const checkedAt = new Date().toISOString();
			const error = this.safeErrorMessage(e, "delta_token_verification_failed");

			await this.db.updateAccountMeta(account, {
				delta: {
					...((account.accountMeta ?? {}).delta ?? {}),
					lastVerifyStatus: "failed",
					lastVerifyError: error,
					lastVerifyAt: checkedAt,
				},
				deltaLastVerifyStatus: "failed",
				deltaLastVerifyError: error,
				deltaLastVerifyAt: checkedAt,
			});

			return {
				valid: false,
				tradingAccountId,
				broker: status.broker,
				checkedAt,
				error,
			};
		}
	}

	async deleteAuthToken(userId: number, tradingAccountId: number) {
		const account = await this.getAccountOrThrow(userId, tradingAccountId);
		const broker = this.assertDeltaAccount(account);

		await this.db.clearAuthMeta(account);

		return {
			deleted: true,
			tradingAccountId,
			broker,
		};
	}

	async placeOrder(req: DeltaPlaceOrderRequest) {
		const account = await this.getAccountOrThrow(req.userId, req.tradingAccountId);
		const payload = await this.buildDeltaOrderPayload(req.order);

		const response = await this.signedRequest({
			account,
			method: "POST",
			path: "/orders",
			payload,
		});

		const orderId = this.extractOrderId(response);

		return {
			success: true,
			orderId,
			raw: response,
		};
	}

	async modifyOrder(req: DeltaModifyOrderRequest) {
		const account = await this.getAccountOrThrow(req.userId, req.tradingAccountId);

		const payload: Record<string, any> = {};

		if (req.quantity !== undefined && req.quantity !== null) {
			payload.size = Number(req.quantity);
		}

		if (req.price !== undefined && req.price !== null) {
			payload.limit_price = String(req.price);
		}

		const response = await this.signedRequest({
			account,
			method: "PUT",
			path: `/orders/${req.orderId}`,
			payload,
		});

		return {
			success: true,
			orderId: req.orderId,
			raw: response,
		};
	}

	async cancelOrder(req: DeltaCancelOrderRequest) {
		const account = await this.getAccountOrThrow(req.userId, req.tradingAccountId);

		const response = await this.signedRequest({
			account,
			method: "DELETE",
			path: `/orders/${req.orderId}`,
		});

		return {
			success: true,
			orderId: req.orderId,
			raw: response,
		};
	}

	async getOrders(userId: number, tradingAccountId: number) {
		const account = await this.getAccountOrThrow(userId, tradingAccountId);

		return this.signedRequest({
			account,
			method: "GET",
			path: "/orders",
		});
	}

	async getPositions(userId: number, tradingAccountId: number) {
		const account = await this.getAccountOrThrow(userId, tradingAccountId);

		return this.signedRequest({
			account,
			method: "GET",
			path: "/positions",
		});
	}

	async getHoldings(userId: number, tradingAccountId: number) {
		const account = await this.getAccountOrThrow(userId, tradingAccountId);

		return this.signedRequest({
			account,
			method: "GET",
			path: "/wallet/balances",
		});
	}

	async getPublicProducts() {
		return this.publicRequest("/products");
	}

	async getPublicTicker(req: DeltaPublicTickerRequest) {
		if (req.productId && Number.isFinite(Number(req.productId))) {
			return this.publicRequest(`/tickers/${Number(req.productId)}`);
		}

		const symbol = req.symbol ? this.normalizeSymbol(req.symbol) : undefined;

		const data = await this.publicRequest("/tickers");

		if (!symbol) {
			return data;
		}

		const result = Array.isArray(data?.result)
			? data.result
			: Array.isArray(data)
				? data
				: [];

		return result.filter((row: any) => {
			const rowSymbol = this.normalizeSymbol(
				row?.symbol ??
				row?.contract_symbol ??
				row?.product?.symbol ??
				""
			);

			return rowSymbol === symbol;
		});
	}

	async getPublicOrderbook(req: DeltaPublicOrderbookRequest) {
		let productId = req.productId;

		if (!productId && req.symbol) {
			productId = await this.resolveProductId({
				symbol: req.symbol,
				side: "BUY",
				quantity: 1,
				orderType: "MARKET",
			});
		}

		if (!productId) {
			throw {
				statusCode: 400,
				message: "productId_or_symbol_required",
			};
		}

		return this.publicRequest(`/l2orderbook/${Number(productId)}`);
	}

	async executePendingBatch(opts?: DeltaBatchRequest) {
		const batchSize =
			opts?.batchSize ??
			Number(process.env.DELTA_EXEC_BATCH_SIZE ?? 25);

		const trades = await this.db.claimPendingTrades(batchSize);

		if (!trades.length) {
			return {
				ok: true,
				processed: 0,
				executed: 0,
				failed: 0,
			};
		}

		const updates: {
			id: number;
			status: string;
			error?: string;
			brokerOrderId?: string | null;
		}[] = [];

		for (const trade of trades) {
			try {
				if (!(trade as any).tradingAccount) {
					updates.push({
						id: trade.id,
						status: "failed",
						error: "missing_trading_account",
					});
					continue;
				}

				const order = this.buildOrderFromSignal(trade);
				const tradingAccountId = Number((trade as any).tradingAccount.id);
				const userId = Number((trade as any).userId);

				const result = await this.placeOrder({
					userId,
					tradingAccountId,
					order,
				});

				console.info("[DELTA] EXEC OK", {
					tradeSignalId: trade.id,
					tradingAccountId,
					symbol: order.symbol,
					side: order.side,
					quantity: order.quantity,
					orderId: result?.orderId ?? null,
				});

				updates.push({
					id: trade.id,
					status: "executed",
					brokerOrderId: result?.orderId ?? null,
				});
			} catch (e: any) {
				const error = this.safeErrorMessage(e, "delta_execution_failed");

				console.error("[DELTA] EXEC FAILED", {
					tradeSignalId: trade.id,
					error,
					upstream: e?.data ?? null,
				});

				updates.push({
					id: trade.id,
					status: "failed",
					error,
				});
			}
		}

		await this.db.updateTradeStatus(updates);

		const executed = updates.filter((u) => u.status === "executed").length;
		const failed = updates.filter((u) => u.status === "failed").length;

		console.info("[DELTA] EXEC BATCH SUMMARY", {
			processed: trades.length,
			executed,
			failed,
		});

		return {
			ok: true,
			processed: trades.length,
			executed,
			failed,
		};
	}
}