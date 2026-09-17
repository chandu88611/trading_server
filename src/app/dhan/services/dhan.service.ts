import { decryptCredentials, decrypt } from "../../../utils/crypto";
import { TradeGuardService } from "../../trade/services/tradeGuard.service";
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
	clientId?: string;
};

export class DhanService {
	private db = new DhanDB();
	private instrumentResolveCache = new Map<string, { securityId: string; exchangeSegment: string; lotSize: number; fetchedAt: number }>();

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

	private parseCsvLine(line: string): string[] {
		const out: string[] = [];
		let cur = "";
		let inQuotes = false;
		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			if (ch === '"') {
				if (inQuotes && line[i + 1] === '"') {
					cur += '"';
					i++;
				} else {
					inQuotes = !inQuotes;
				}
				continue;
			}
			if (ch === "," && !inQuotes) {
				out.push(cur);
				cur = "";
				continue;
			}
			cur += ch;
		}
		out.push(cur);
		return out;
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
		const meta = this.asObject(decryptCredentials(account?.accountMeta));
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
		console.log("[DHAN] Token generation response", { url, status: res.status, clientId, apiKey: !!apiKey, apiSecret: !!apiSecret, res });

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
		const meta = this.asObject(decryptCredentials(account?.accountMeta));
		const dhan = this.asObject(meta?.dhan);

		const baseUrl = String(
			this.pickFirstString(
				dhan.baseUrl,
				meta.baseUrl,
				process.env.DHAN_BASE_URL,
				"https://api.dhan.co/v2"
			) ?? ""
		).trim();
		const accessToken = decrypt(String(dhan.accessToken ?? account?.accessToken ?? "").trim());
		const apiKey = String(dhan.apiKey ?? process.env.DHAN_API_KEY ?? "").trim() || undefined;
		const clientId = String(this.pickFirstString(dhan.clientId, meta.clientId, meta.accountId, account?.accountId) ?? "").trim() || undefined;

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

		return { baseUrl, accessToken, apiKey, clientId };
	}

	private normalizeExchange(raw?: string): string {
		const e = String(raw ?? "NSE").trim().toUpperCase();
		if (e === "NSE_DLY") return "NSE";
		if (e === "BSE_DLY") return "BSE";
		if (e === "NSE_EQ" || e === "NSECM") return "NSE";
		if (e === "BSE_EQ" || e === "BSECM") return "BSE";
		if (e === "NFO" || e === "NSE_FNO") return "NFO";
		if (e === "MCX" || e === "MCX_COMM") return "MCX";
		return e || "NSE";
	}

	private normalizeTradableSymbol(symbol?: string): string {
		let s = String(symbol ?? "").trim().toUpperCase();
		if (!s) return s;
		if (s.includes(":")) s = s.split(":").pop() ?? s;
		return s.replace(/\s+/g, "");
	}

	private normalizeDhanOrderPayload(order: Record<string, any>): Record<string, any> {
		const quantity = Math.max(1, Math.floor(Number(order.quantity ?? 1)));
		const normalized: Record<string, any> = {
			symbol: this.normalizeTradableSymbol(order.symbol),
			exchange: this.normalizeExchange(order.exchange),
			side: String(order.side ?? "BUY").toUpperCase().startsWith("S") ? "SELL" : "BUY",
			quantity,
			orderType: String(order.orderType ?? "MARKET").toUpperCase(),
			product: String(order.product ?? "CNC").toUpperCase(),
			validity: String(order.validity ?? "DAY").toUpperCase(),
			price: order.price != null ? Number(order.price) : undefined,
			triggerPrice: order.triggerPrice != null ? Number(order.triggerPrice) : undefined,
			tag: order.tag,
		};

		Object.keys(normalized).forEach((k) => normalized[k] === undefined && delete normalized[k]);
		return normalized;
	}

	private async resolveDerivativeSecurityIdForIndex(
		config: DhanConfig,
		symbol: string
	): Promise<{ securityId: string; exchangeSegment: string; lotSize: number } | null> {
		const key = symbol.toUpperCase();
		const cached = this.instrumentResolveCache.get(key);
		if (cached && Date.now() - cached.fetchedAt < 10 * 60 * 1000) {
			return { securityId: cached.securityId, exchangeSegment: cached.exchangeSegment, lotSize: cached.lotSize };
		}

		try {
			const base = config.baseUrl.replace(/\/+$/, "");
			const url = `${base}/instrument/NSE_FNO`;
			const res = await fetch(url, { method: "GET", headers: { accept: "text/csv,*/*" } });
			if (!res.ok) return null;
			const csv = await res.text();
			if (!csv) return null;

			const lines = csv.split(/\r?\n/).filter(Boolean);
			if (lines.length < 2) return null;

			type Candidate = { securityId: string; expiryTime: number; lotSize: number };
			const now = Date.now();
			const candidates: Candidate[] = [];

			for (let i = 1; i < lines.length; i++) {
				const cols = this.parseCsvLine(lines[i]);
				if (cols.length < 13) continue;
				const securityId = String(cols[2] ?? "").trim();
				const instrument = String(cols[4] ?? "").trim().toUpperCase();
				const underlying = String(cols[6] ?? "").trim().toUpperCase();
				const lotSize = Number(cols[11] ?? 0);
				const expiryRaw = String(cols[12] ?? "").trim();

				if (!securityId || !underlying || !expiryRaw) continue;
				if (underlying !== key) continue;
				if (!(instrument === "FUTIDX" || instrument === "FUTSTK")) continue;

				const expiry = Date.parse(expiryRaw);
				if (!Number.isFinite(expiry) || expiry < now - 24 * 60 * 60 * 1000) continue;

				candidates.push({ securityId, expiryTime: expiry, lotSize: Number.isFinite(lotSize) && lotSize > 0 ? lotSize : 1 });
			}

			candidates.sort((a, b) => a.expiryTime - b.expiryTime);
			if (!candidates.length) return null;

			const resolved = {
				securityId: candidates[0].securityId,
				exchangeSegment: "NSE_FNO",
				lotSize: candidates[0].lotSize,
				fetchedAt: Date.now(),
			};
			this.instrumentResolveCache.set(key, resolved);
			return { securityId: resolved.securityId, exchangeSegment: resolved.exchangeSegment, lotSize: resolved.lotSize };
		} catch {
			return null;
		}
	}

	private async toDhanOfficialPayload(config: DhanConfig, order: Record<string, any>): Promise<Record<string, any>> {
		const symbol = this.normalizeTradableSymbol(order.symbol);
		const exchange = this.normalizeExchange(order.exchange);
		let quantity = Math.max(1, Math.floor(Number(order.quantity ?? 1)));
		const orderType = String(order.orderType ?? "MARKET").toUpperCase();
		const product = String(order.product ?? "CNC").toUpperCase();

		const exchangeSegmentMap: Record<string, string> = {
			NSE: "NSE_EQ",
			BSE: "BSE_EQ",
			NFO: "NSE_FNO",
			MCX: "MCX_COMM",
		};
		const productTypeMap: Record<string, string> = {
			CNC: "CNC",
			DELIVERY: "CNC",
			MIS: "INTRADAY",
			INTRADAY: "INTRADAY",
			NRML: "MARGIN",
			MARGIN: "MARGIN",
		};

		const payload: Record<string, any> = {
			dhanClientId: config.clientId,
			transactionType: String(order.side ?? "BUY").toUpperCase().startsWith("S") ? "SELL" : "BUY",
			exchangeSegment: exchangeSegmentMap[exchange] ?? "NSE_EQ",
			productType: productTypeMap[product] ?? "CNC",
			orderType,
			validity: String(order.validity ?? "DAY").toUpperCase(),
			quantity,
			correlationId: order.tag,
			disclosedQuantity: 0,
			triggerPrice: Number(order.triggerPrice ?? 0),
			afterMarketOrder: false,
			boProfitValue: 0,
			boStopLossValue: 0,
		};

		if (/^\d+$/.test(symbol)) payload.securityId = symbol;
		else payload.tradingSymbol = symbol;

		const indexLike = new Set(["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX", "BANKEX"]);
		if (!payload.securityId && indexLike.has(symbol) && payload.exchangeSegment === "NSE_EQ") {
			const resolved = await this.resolveDerivativeSecurityIdForIndex(config, symbol);
			if (resolved) {
				console.info("[DHAN] Resolved index root symbol to derivative securityId", {
					symbol,
					securityId: resolved.securityId,
					exchangeSegment: resolved.exchangeSegment,
					lotSize: resolved.lotSize,
				});
				payload.securityId = resolved.securityId;
				payload.exchangeSegment = resolved.exchangeSegment;
				if (resolved.lotSize > 1) {
					quantity = Math.max(resolved.lotSize, Math.ceil(quantity / resolved.lotSize) * resolved.lotSize);
					payload.quantity = quantity;
				}
				delete payload.tradingSymbol;
			} else {
				console.warn("[DHAN] Could not resolve derivative securityId for index root symbol", { symbol });
				throw {
					statusCode: HttpStatusCode._BAD_REQUEST,
					message: "dhan_symbol_not_tradable_in_equity_segment",
					data: {
						symbol,
						hint: "Use derivative trading symbol (e.g. NIFTY-<expiry>-<strike>-CE/PE) or securityId from instrument master",
					},
				};
			}
		}

		if (payload.exchangeSegment === "NSE_FNO" && payload.productType === "CNC") {
			payload.productType = "INTRADAY";
		}

		payload.price = orderType === "MARKET" ? 0 : Number(order.price ?? 0);

		Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
		return payload;
	}

	private isDhanMissingFieldError(err: any): boolean {
		const status = Number(err?.data?.status ?? 0);
		const code = String(err?.data?.payload?.errorCode ?? "").trim();
		const message = String(err?.data?.payload?.errorMessage ?? "").toLowerCase();
		return status === 400 && (code === "DH-905" || message.includes("missing required fields"));
	}

	private isDhanProductScripError(err: any): boolean {
		const status = Number(err?.data?.status ?? 0);
		const code = String(err?.data?.payload?.errorCode ?? "").trim();
		const message = String(err?.data?.payload?.errorMessage ?? "").toLowerCase();
		return status === 400 && (code === "DH-906" || message.includes("not allowed for this product"));
	}

	private async placeOrderWithFallback(config: DhanConfig, normalizedPayload: Record<string, any>) {
		const officialPayload = await this.toDhanOfficialPayload(config, normalizedPayload);
		try {
			return await this.dhanRequest(config, "POST", "orders", officialPayload);
		} catch (e: any) {
			if (this.isDhanProductScripError(e)) {
				const altProductPayload = {
					...officialPayload,
					productType: String(officialPayload.productType ?? "").toUpperCase() === "INTRADAY" ? "MARGIN" : "INTRADAY",
				};
				try {
					return await this.dhanRequest(config, "POST", "orders", altProductPayload);
				} catch (eAlt: any) {
					throw {
						...eAlt,
						data: {
							...(eAlt?.data ?? {}),
							request: { primary: officialPayload, productRetry: altProductPayload },
						},
					};
				}
			}

			if (!this.isDhanMissingFieldError(e)) throw e;
			if (!process.env.DHAN_ENABLE_LEGACY_PLACE_FALLBACK) throw e;
			const altPayload = normalizedPayload;
			try {
				return await this.dhanRequest(config, "POST", "orders/place", altPayload);
			} catch (e2: any) {
				throw {
					...e2,
					data: {
						...(e2?.data ?? {}),
						request: { primary: officialPayload, fallback: altPayload },
					},
				};
			}
		}
	}

	private async dhanRequest(
		config: DhanConfig,
		method: "GET" | "POST" | "PUT" | "DELETE",
		path: string,
		body?: any
	) {
		const url = `${config.baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

		const res = await fetch(url, {
			method,
			headers: {
				"content-type": "application/json",
				accept: "application/json",
				"access-token": config.accessToken,
				Authorization: `Bearer ${config.accessToken}`,
				...(config.apiKey ? { "x-api-key": config.apiKey } : {}),
			},
			body: body ? JSON.stringify(body) : undefined,
		});

		console.log(`[DHAN] API response for ${method} ${path}`, { url, response: res, body });

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
		const symbol = this.normalizeTradableSymbol(String(signal.symbol));
		const exchange = this.normalizeExchange(signal.exchange ? String(signal.exchange) : undefined);
		return {
			symbol,
			exchange: exchange,
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

		const payload: Record<string, any> = this.normalizeDhanOrderPayload({
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
		});

		const data = await this.placeOrderWithFallback(cfg, payload);

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

		const payload: Record<string, any> = {
			dhanClientId: cfg.clientId,
			orderId: req.orderId,
			orderType: "LIMIT",
			validity: req.validity ? String(req.validity).toUpperCase() : "DAY",
		};
		if (typeof req.quantity === "number") payload.quantity = req.quantity;
		if (typeof req.price === "number") payload.price = req.price;
		if (typeof req.triggerPrice === "number") payload.triggerPrice = req.triggerPrice;
		if (req.validity) payload.validity = String(req.validity).toUpperCase();

		const data = await this.dhanRequest(cfg, "PUT", `orders/${encodeURIComponent(req.orderId)}`, payload);
		return { orderId: req.orderId, raw: data };
	}

	async cancelOrder(req: DhanCancelOrderRequest) {
		const account = await this.db.getTradingAccountById(req.userId, req.tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}

		const cfg = this.getDhanConfigFromAccount(account);
		const data = await this.dhanRequest(cfg, "DELETE", `orders/${encodeURIComponent(req.orderId)}`);
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

  async getTradeHistory(userId: number, tradingAccountId: number) {
    const account = await this.db.getTradingAccountById(userId,tradingAccountId);
    if (!account) throw { statusCode: 404, message: "trading_account_not_found" };
    return this.dhanRequest(this.getDhanConfigFromAccount(account), "GET", "trades");
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

	/** Account funds/margin — normalized to the shared funds shape (matches Zebu). */
	async getFunds(userId: number, tradingAccountId: number) {
		const account = await this.db.getTradingAccountById(userId, tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}

		const cfg = this.getDhanConfigFromAccount(account);
		const raw: any = (await this.dhanRequest(cfg, "GET", "fundlimit")) ?? {};

		const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
		const availableCash = num(raw.availabelBalance ?? raw.availableBalance ?? raw.withdrawableBalance);
		const marginUsed = num(raw.utilizedAmount ?? raw.usedAmount);
		const collateral = num(raw.collateralAmount ?? raw.collateral);
		return {
			ok: true,
			availableCash,
			marginUsed,
			collateral,
			totalFunds: num(raw.sodLimit) || availableCash + marginUsed,
			raw,
		};
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

		const updates: { id: number; status: string; error?: string; brokerOrderId?: string }[] = [];

		for (const t of trades) {
            if (!(await new TradeGuardService().validateTrade(t.tradingAccount, t)).allowed) continue;
			try {
				if (!t.tradingAccount) {
					updates.push({ id: t.id, status: "failed", error: "missing_trading_account" });
					continue;
				}

				const cfg = this.getDhanConfigFromAccount(t.tradingAccount as any);
				const order = this.buildOrderFromSignal(t);

				const payload: Record<string, any> = this.normalizeDhanOrderPayload({
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
				});

				const placed: any = await this.placeOrderWithFallback(cfg, payload);
                const brokerOrderId = String(placed?.orderId ?? placed?.data?.orderId ?? "");
                if (!brokerOrderId) throw new Error("missing_broker_order_id");
				console.info("[DHAN] EXEC OK", {
					tradeSignalId: t.id,
					symbol: payload.symbol,
					exchange: payload.exchange,
					quantity: payload.quantity,
				});
				updates.push({ id: t.id, status: "submitted", brokerOrderId });
			} catch (e: any) {
				console.log(e);
				console.error("[DHAN] EXEC FAILED", {
					tradeSignalId: t.id,
					error: e?.message ?? String(e),
					payload: e?.data,
				});
				updates.push({ id: t.id, status: "failed", error: e?.message ?? String(e) });
			}
		}

		await this.db.updateTradeStatus(updates);
		const executed = updates.filter((u) => u.status === "executed").length;
		const failed = updates.filter((u) => u.status === "failed").length;
		console.info("[DHAN] EXEC BATCH SUMMARY", {
			processed: trades.length,
			executed,
			failed,
		});
		return { ok: true, processed: trades.length };
	}
}
