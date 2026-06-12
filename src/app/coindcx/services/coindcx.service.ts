import crypto from "crypto";
import { HttpStatusCode } from "../../../types/constants";
import { TradingAccountStatus } from "../../subscriptionPlan/enums/subscriberPlan.enum";
import {
	CoinDCXAuthPayload,
	CoinDCXBatchRequest,
	CoinDCXCancelOrderRequest,
	CoinDCXModifyOrderRequest,
	CoinDCXOrderPayload,
	CoinDCXPlaceOrderRequest,
	CoinDCXPublicOrderbookRequest,
	CoinDCXPublicTickerRequest,
} from "../interfaces/coindcx";
import { TradeSignal } from "../../../entity/TradeSignals";
import { CoinDCXDB } from "./coindcx.db";

type CoinDCXConfig = {
	baseUrl: string;
	apiKey: string;
	apiSecret: string;
};

export class CoinDCXService {
	private db = new CoinDCXDB();
	private readonly knownQuotes = ["USDT", "USDC", "INR", "BTC", "ETH", "BNB", "EUR", "USD"] as const;
	private readonly preferredQuotes = ["USDT", "INR", "USDC", "BTC", "ETH", "BNB", "EUR"] as const;
	private readonly minLimitPrice = Number(process.env.COINDCX_MIN_LIMIT_PRICE ?? 0.00001);
	private readonly maxLimitPrice = Number(process.env.COINDCX_MAX_LIMIT_PRICE ?? 10000000000);
	private marketDiscoveryCache?: { expiresAt: number; markets: Set<string> };

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

	private normalizeCoinDCXMarket(symbol?: string): string {
		let normalized = String(symbol ?? "").trim().toUpperCase();
		if (!normalized) return normalized;

		if (normalized.includes(":")) {
			normalized = normalized.split(":").pop() ?? normalized;
		}

		return normalized.replace(/[-_/:\s]/g, "");
	}

	private splitBaseAndQuote(symbol: string): { base: string; quote?: string } {
		for (const quote of this.knownQuotes) {
			if (symbol.endsWith(quote) && symbol.length > quote.length) {
				return {
					base: symbol.slice(0, -quote.length),
					quote,
				};
			}
		}
		return { base: symbol };
	}

	private buildMarketCandidates(symbol?: string): string[] {
		const base = this.normalizeCoinDCXMarket(symbol);
		if (!base) return [];

		const candidates = new Set<string>([base]);
		const { base: root, quote } = this.splitBaseAndQuote(base);

		if (!quote) {
			for (const q of this.preferredQuotes) {
				candidates.add(`${root}${q}`);
			}
		}

		if (base.endsWith("USD") && !base.endsWith("USDT")) {
			const onlyBase = base.slice(0, -3);
			if (onlyBase) {
				candidates.add(`${base}T`); // BTCUSD -> BTCUSDT
				candidates.add(`${onlyBase}USDT`);
			}
		}

		if (base.endsWith("USDC")) {
			candidates.add(`${base.slice(0, -4)}USDT`);
		}

		return Array.from(candidates);
	}

	private isMarketDiscoveryEnabled(): boolean {
		const isTestRun = process.argv.includes("--test") || process.execArgv.includes("--test");
		if (isTestRun) return false;
		return String(process.env.COINDCX_MARKET_DISCOVERY_ENABLED ?? "1") !== "0";
	}

	private toNormalizedCoinDCXMarketFromAny(value: unknown): string | null {
		const normalized = this.normalizeCoinDCXMarket(String(value ?? ""));
		if (!normalized) return null;
		return normalized;
	}

	private addMarketCandidatesFromDetailsRow(target: Set<string>, row: any) {
		const byPairParts = this.normalizeCoinDCXMarket(
			`${String(row?.base_currency_short_name ?? "")}${String(row?.target_currency_short_name ?? "")}`
		);
		if (byPairParts) target.add(byPairParts);

		const directFields = [row?.market, row?.symbol, row?.pair, row?.coindcx_name];
		for (const field of directFields) {
			const normalized = this.toNormalizedCoinDCXMarketFromAny(field);
			if (normalized) target.add(normalized);
		}
	}

	private async getKnownCoinDCXMarkets(): Promise<Set<string>> {
		const now = Date.now();
		if (this.marketDiscoveryCache && this.marketDiscoveryCache.expiresAt > now) {
			return this.marketDiscoveryCache.markets;
		}

		try {
			const path = this.pickFirstString(process.env.COINDCX_PUBLIC_MARKETS_PATH, "exchange/v1/markets_details")!;
			const data = await this.coindcxPublicRequest(path);
			if (!Array.isArray(data)) return new Set<string>();

			const markets = new Set<string>();
			for (const row of data) {
				this.addMarketCandidatesFromDetailsRow(markets, row);
			}

			const ttlMs = Number(process.env.COINDCX_MARKET_DISCOVERY_TTL_MS ?? 5 * 60 * 1000);
			this.marketDiscoveryCache = {
				expiresAt: now + (Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : 5 * 60 * 1000),
				markets,
			};

			return markets;
		} catch {
			return new Set<string>();
		}
	}

	private async filterValidMarketCandidates(candidates: string[]): Promise<string[]> {
		if (!this.isMarketDiscoveryEnabled()) return candidates;
		const knownMarkets = await this.getKnownCoinDCXMarkets();
		if (!knownMarkets.size) return candidates;

		const filtered = candidates.filter((c) => knownMarkets.has(c));
		return filtered;
	}

	private isCoinDCXInvalidPairError(err: any): boolean {
		const status = Number(err?.data?.status ?? 0);
		const message = String(err?.data?.payload?.message ?? "").toLowerCase();
		return status === 422 && (message.includes("currency pair") || message.includes("pair is not valid"));
	}

	private isCoinDCXInvalidPriceError(err: any): boolean {
		const status = Number(err?.data?.status ?? 0);
		const message = String(err?.data?.payload?.message ?? "").toLowerCase();
		return status === 400 && message.includes("price should be within range");
	}

	private extractCoinDCXPrecisionFromError(err: any): number | null {
		const status = Number(err?.data?.status ?? 0);
		const message = String(err?.data?.payload?.message ?? "");
		if (status !== 400) return null;

		const m = message.match(/precision\s+should\s+be\s+(\d+)/i);
		if (!m) return null;

		const precision = Number(m[1]);
		if (!Number.isInteger(precision) || precision < 0 || precision > 18) return null;
		return precision;
	}

	private toFixedPrecisionString(value: unknown, precision: number): string | null {
		const num = Number(value);
		if (!Number.isFinite(num)) return null;
		return num.toFixed(precision);
	}

	private isPriceWithinCoinDCXRange(price: number): boolean {
		if (!Number.isFinite(price) || price <= 0) return false;
		return price >= this.minLimitPrice && price <= this.maxLimitPrice;
	}

	private normalizeCoinDCXPair(symbol?: string): string {
		return String(symbol ?? "")
			.trim()
			.toUpperCase()
			.replace(/[\-/:\s]/g, "_");
	}

	private getCoinDCXPublicBaseUrl(): string {
		const baseUrl = String(
			this.pickFirstString(process.env.COINDCX_PUBLIC_BASE_URL, process.env.COINDCX_BASE_URL, "https://api.coindcx.com") ?? ""
		).trim();

		if (!baseUrl) {
			throw {
				statusCode: HttpStatusCode._BAD_REQUEST,
				message: "coindcx_base_url_missing",
			};
		}

		return baseUrl;
	}

	private async coindcxPublicRequest(path: string, query?: Record<string, string | undefined>) {
		const baseUrl = this.getCoinDCXPublicBaseUrl();
		const url = new URL(`${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`);

		Object.entries(query ?? {}).forEach(([k, v]) => {
			if (v && String(v).trim()) url.searchParams.set(k, String(v).trim());
		});

		const res = await fetch(url.toString(), {
			method: "GET",
			headers: {
				accept: "application/json",
			},
		});

		const ct = res.headers.get("content-type") ?? "";
		let responsePayload: any = null;
		try {
			responsePayload = ct.includes("application/json") ? await res.json() : await res.text();
		} catch {
			responsePayload = null;
		}

		if (!res.ok) {
			throw {
				statusCode: HttpStatusCode._BAD_GATEWAY,
				message: "coindcx_public_upstream_failed",
				data: { status: res.status, payload: responsePayload },
			};
		}

		return responsePayload;
	}

	private getCoinDCXConfigFromAccount(account: any): CoinDCXConfig {
		const meta = this.asObject(account?.accountMeta);
		const coindcx = this.asObject(meta?.coindcx);

		const baseUrl = String(
			this.pickFirstString(coindcx.baseUrl, process.env.COINDCX_BASE_URL, "https://api.coindcx.com") ?? ""
		).trim();
		const apiKey = String(this.pickFirstString(coindcx.apiKey) ?? "").trim();
		const apiSecret = String(this.pickFirstString(coindcx.apiSecret) ?? "").trim();

		if (!baseUrl) {
			throw {
				statusCode: HttpStatusCode._BAD_REQUEST,
				message: "coindcx_base_url_missing",
			};
		}

		if (!apiKey || !apiSecret) {
			throw {
				statusCode: HttpStatusCode._BAD_REQUEST,
				message: "coindcx_credentials_missing",
			};
		}

		return { baseUrl, apiKey, apiSecret };
	}

	private async coindcxPrivateRequest(config: CoinDCXConfig, path: string, body: Record<string, any> = {}) {
		const url = `${config.baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
		const payload = {
			timestamp: Number(body.timestamp ?? Date.now()),
			...body,
		};
		const payloadJson = JSON.stringify(payload);
		const signature = crypto.createHmac("sha256", config.apiSecret).update(payloadJson).digest("hex");

		const res = await fetch(url, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json",
				"X-AUTH-APIKEY": config.apiKey,
				"X-AUTH-SIGNATURE": signature,
			},
			body: payloadJson,
		});

		const ct = res.headers.get("content-type") ?? "";
		let responsePayload: any = null;
		try {
			responsePayload = ct.includes("application/json") ? await res.json() : await res.text();
		} catch {
			responsePayload = null;
		}
        console.log("[CoinDCX] API RESPONSE", {
            url,
            requestPayload: payload,
            responseStatus: res.status,
            responsePayload,
            res
        });
		if (!res.ok) {
			throw {
				statusCode: HttpStatusCode._BAD_GATEWAY,
				message: "coindcx_upstream_failed",
				data: { status: res.status, payload: responsePayload },
			};
		}

		return responsePayload;
	}

	async saveAuthToken(payload: CoinDCXAuthPayload) {
		const account = await this.db.getTradingAccountById(payload.userId, payload.tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}

		const existingMeta = this.asObject(account.accountMeta);
		const existingCoinDCX = this.asObject(existingMeta.coindcx);

		const nextMeta = {
			coindcx: {
				...existingCoinDCX,
				apiKey: payload.apiKey,
				apiSecret: payload.apiSecret,
				baseUrl: payload.baseUrl ?? existingCoinDCX.baseUrl,
				updatedAt: new Date().toISOString(),
			},
		};

		if (account.status !== TradingAccountStatus.VERIFIED) {
			account.status = TradingAccountStatus.VERIFIED;
		}

		await this.db.updateAccountMeta(account, nextMeta);

		return { ok: true };
	}

	private buildOrderFromSignal(signal: TradeSignal): CoinDCXOrderPayload {
		return {
			symbol: this.normalizeCoinDCXMarket(String(signal.symbol)),
			side: String(signal.action).toUpperCase() === "SELL" ? "SELL" : "BUY",
			quantity: Number(signal.volume) || 1,
			orderType: signal.price != null ? "LIMIT" : "MARKET",
			price: signal.price != null ? Number(signal.price) : undefined,
			clientOrderId: `signal_${signal.id}`,
		};
	}

	async placeOrder(req: CoinDCXPlaceOrderRequest) {
		const account = await this.db.getTradingAccountById(req.userId, req.tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}

		const cfg = this.getCoinDCXConfigFromAccount(account);
		const candidateMarkets = this.buildMarketCandidates(req.order.symbol);
		if (!candidateMarkets.length) {
			throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "coindcx_symbol_required" };
		}

		const marketCandidates = await this.filterValidMarketCandidates(candidateMarkets);
		if (!marketCandidates.length) {
			throw {
				statusCode: HttpStatusCode._BAD_REQUEST,
				message: "coindcx_no_valid_market_found",
				data: {
					symbol: req.order.symbol,
					triedMarkets: candidateMarkets,
				},
			};
		}

		const requestedOrderType = String(req.order.orderType ?? "LIMIT").toUpperCase();
		const requestedPrice = Number(req.order.price ?? 0);
		const canUseLimit =
			requestedOrderType !== "MARKET" && this.isPriceWithinCoinDCXRange(requestedPrice);

		if (requestedOrderType !== "MARKET" && !canUseLimit) {
			console.warn("[COINDCX] Limit price invalid/out-of-range; falling back to market order", {
				symbol: req.order.symbol,
				price: req.order.price,
				minLimitPrice: this.minLimitPrice,
				maxLimitPrice: this.maxLimitPrice,
			});
		}

		const basePayload: Record<string, any> = {
			side: String(req.order.side ?? "BUY").toLowerCase().startsWith("s") ? "sell" : "buy",
			order_type: canUseLimit ? "limit_order" : "market_order",
			total_quantity: String(Number(req.order.quantity ?? 0)),
			client_order_id: req.order.clientOrderId,
		};

		if (basePayload.order_type === "limit_order") {
			basePayload.price_per_unit = String(requestedPrice);
		}

		const path = this.pickFirstString(process.env.COINDCX_ORDER_CREATE_PATH, "exchange/v1/orders/create")!;

		let lastError: any = null;
		for (let i = 0; i < marketCandidates.length; i++) {
			const payload: Record<string, any> = {
				...basePayload,
				market: marketCandidates[i],
			};
			Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

			try {
				const data = await this.coindcxPrivateRequest(cfg, path, payload);
				const first = Array.isArray(data) ? data[0] : data;
				const orderId = first?.id || first?.order_id || first?.orderId || null;
				return { orderId: orderId ? String(orderId) : null, raw: data };
			} catch (err: any) {
				if (payload.order_type === "limit_order") {
					const requiredPrecision = this.extractCoinDCXPrecisionFromError(err);
					if (requiredPrecision !== null) {
						const normalizedPrice = this.toFixedPrecisionString(payload.price_per_unit, requiredPrecision);
						if (normalizedPrice && normalizedPrice !== String(payload.price_per_unit)) {
							const precisionRetryPayload: Record<string, any> = {
								...payload,
								price_per_unit: normalizedPrice,
							};

							console.warn("[COINDCX] Limit order rejected for precision; retrying with normalized price", {
								originalSymbol: req.order.symbol,
								market: payload.market,
								originalPrice: payload.price_per_unit,
								normalizedPrice,
								requiredPrecision,
							});

							try {
								const data = await this.coindcxPrivateRequest(cfg, path, precisionRetryPayload);
								const first = Array.isArray(data) ? data[0] : data;
								const orderId = first?.id || first?.order_id || first?.orderId || null;
								return { orderId: orderId ? String(orderId) : null, raw: data };
							} catch (precisionErr: any) {
								lastError = precisionErr;
								err = precisionErr;
							}
						}
					}
				}

				if (payload.order_type === "limit_order" && this.isCoinDCXInvalidPriceError(err)) {
					const marketFallbackPayload: Record<string, any> = {
						...payload,
						order_type: "market_order",
					};
					delete marketFallbackPayload.price_per_unit;

					console.warn("[COINDCX] Limit order rejected for price range; retrying as market order", {
						originalSymbol: req.order.symbol,
						market: payload.market,
						price: payload.price_per_unit,
					});

					try {
						const data = await this.coindcxPrivateRequest(cfg, path, marketFallbackPayload);
						const first = Array.isArray(data) ? data[0] : data;
						const orderId = first?.id || first?.order_id || first?.orderId || null;
						return { orderId: orderId ? String(orderId) : null, raw: data };
					} catch (fallbackErr: any) {
						lastError = fallbackErr;
					}
				}

				lastError = err;
				const canRetry = i < marketCandidates.length - 1 && this.isCoinDCXInvalidPairError(err);
				if (canRetry) {
					console.warn("[COINDCX] Invalid market, retrying with alternate candidate", {
						originalSymbol: req.order.symbol,
						attemptedMarket: marketCandidates[i],
						nextMarket: marketCandidates[i + 1],
					});
					continue;
				}

				if (this.isCoinDCXInvalidPairError(err)) {
					continue;
				}

				throw err;
			}
		}

		if (lastError && this.isCoinDCXInvalidPairError(lastError)) {
			throw {
				statusCode: HttpStatusCode._BAD_REQUEST,
				message: "coindcx_no_valid_market_found",
				data: {
					symbol: req.order.symbol,
					triedMarkets: marketCandidates,
					upstream: lastError?.data,
				},
			};
		}

		throw lastError ?? { statusCode: HttpStatusCode._BAD_GATEWAY, message: "coindcx_upstream_failed" };
	}

	async modifyOrder(req: CoinDCXModifyOrderRequest) {
		const account = await this.db.getTradingAccountById(req.userId, req.tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}

		const cfg = this.getCoinDCXConfigFromAccount(account);
		const path = this.pickFirstString(process.env.COINDCX_ORDER_MODIFY_PATH, "exchange/v1/orders/edit")!;
		const payload: Record<string, any> = {
			id: req.orderId,
		};
		if (typeof req.quantity === "number") payload.total_quantity = String(req.quantity);
		if (typeof req.price === "number") payload.price_per_unit = String(req.price);

		const data = await this.coindcxPrivateRequest(cfg, path, payload);
		return { orderId: req.orderId, raw: data };
	}

	async cancelOrder(req: CoinDCXCancelOrderRequest) {
		const account = await this.db.getTradingAccountById(req.userId, req.tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}

		const cfg = this.getCoinDCXConfigFromAccount(account);
		const path = this.pickFirstString(process.env.COINDCX_ORDER_CANCEL_PATH, "exchange/v1/orders/cancel")!;
		const data = await this.coindcxPrivateRequest(cfg, path, { id: req.orderId });
		return { orderId: req.orderId, raw: data };
	}

	async getOrders(userId: number, tradingAccountId: number) {
		const account = await this.db.getTradingAccountById(userId, tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}

		const cfg = this.getCoinDCXConfigFromAccount(account);
		const path = this.pickFirstString(process.env.COINDCX_ACTIVE_ORDERS_PATH, "exchange/v1/orders/active_orders")!;
		return this.coindcxPrivateRequest(cfg, path, {});
	}

	async getPositions(userId: number, tradingAccountId: number) {
		const account = await this.db.getTradingAccountById(userId, tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}

		const cfg = this.getCoinDCXConfigFromAccount(account);
		const path = this.pickFirstString(process.env.COINDCX_BALANCES_PATH, "exchange/v1/users/balances")!;
		return this.coindcxPrivateRequest(cfg, path, {});
	}

	async getHoldings(userId: number, tradingAccountId: number) {
		const account = await this.db.getTradingAccountById(userId, tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}

		const cfg = this.getCoinDCXConfigFromAccount(account);
		const path = this.pickFirstString(process.env.COINDCX_BALANCES_PATH, "exchange/v1/users/balances")!;
		return this.coindcxPrivateRequest(cfg, path, {});
	}

	async getPublicTicker(req?: CoinDCXPublicTickerRequest) {
		const path = this.pickFirstString(process.env.COINDCX_PUBLIC_TICKER_PATH, "exchange/ticker")!;
		const data = await this.coindcxPublicRequest(path);

		const market = this.normalizeCoinDCXMarket(req?.market);
		if (!market || !Array.isArray(data)) return data;

		const matched = data.filter((row: any) => {
			const candidateA = this.normalizeCoinDCXMarket(row?.market);
			const candidateB = this.normalizeCoinDCXMarket(row?.symbol);
			return candidateA === market || candidateB === market;
		});

		return matched;
	}

	async getPublicOrderbook(req: CoinDCXPublicOrderbookRequest) {
		const market = String(req?.market ?? "").trim();
		if (!market) {
			throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "market_required" };
		}

		const path = this.pickFirstString(process.env.COINDCX_PUBLIC_ORDERBOOK_PATH, "market_data/orderbook")!;
		const pair = this.normalizeCoinDCXPair(market);
		return this.coindcxPublicRequest(path, {
			pair,
			market: this.normalizeCoinDCXMarket(market),
		});
	}

	async executePendingBatch(opts?: CoinDCXBatchRequest) {
		const batchSize = opts?.batchSize ?? Number(process.env.COINDCX_EXEC_BATCH_SIZE ?? 25);
		const trades = await this.db.claimPendingTrades(batchSize);
		if (!trades.length) return { ok: true, processed: 0 };

		const updates: { id: number; status: string; error?: string }[] = [];

		for (const t of trades) {
			try {
				if (!t.tradingAccount) {
					updates.push({ id: t.id, status: "failed", error: "missing_trading_account" });
					continue;
				}

				const order = this.buildOrderFromSignal(t);
				await this.placeOrder({
					userId: Number(t.userId),
					tradingAccountId: Number((t.tradingAccount as any).id),
					order,
				});

				console.info("[COINDCX] EXEC OK", {
					tradeSignalId: t.id,
					symbol: order.symbol,
					quantity: order.quantity,
				});
				updates.push({ id: t.id, status: "executed" });
			} catch (e: any) {
				console.error("[COINDCX] EXEC FAILED", {
					tradeSignalId: t.id,
					error: e?.message ?? String(e),
					payload: e?.data,
                    error2: e
				});
				updates.push({ id: t.id, status: "failed", error: e?.message ?? String(e) });
			}
		}

		await this.db.updateTradeStatus(updates);
		const executed = updates.filter((u) => u.status === "executed").length;
		const failed = updates.filter((u) => u.status === "failed").length;
		console.info("[COINDCX] EXEC BATCH SUMMARY", {
			processed: trades.length,
			executed,
			failed,
		});

		return { ok: true, processed: trades.length };
	}
}
