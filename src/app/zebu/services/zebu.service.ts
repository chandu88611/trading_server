import { ZebuDB } from "./zebu.db";
import { HttpStatusCode } from "../../../types/constants";
import { TradingAccountStatus } from "../../subscriptionPlan/enums/subscriberPlan.enum";
import crypto from "crypto";
import {
	ZebuAuthPayload,
	ZebuGenerateTokenRequest,
	ZebuBatchRequest,
	ZebuCancelOrderRequest,
	ZebuModifyOrderRequest,
	ZebuPlaceOrderRequest,
	ZebuOrderPayload,
} from "../interfaces/zebu";
import { TradeSignal } from "../../../entity/TradeSignals";

type ZebuConfig = {
	baseUrl: string;
	accessToken: string;
	apiKey?: string;
	uid?: string;
	actid?: string;
};

export class ZebuService {
	private db = new ZebuDB();

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

	private sha256(value: string): string {
		return crypto.createHash("sha256").update(value).digest("hex");
	}

	private normalizeNorenUid(raw?: string): string | undefined {
		const value = this.pickFirstString(raw);
		if (!value) return undefined;
		return value.replace(/_U$/i, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
	}

	private resolveAppKey(uid: string): string {
		const seed = this.pickFirstString(process.env.ZEBU_APPKEY_SEED, "S3cur3!d") as string;
		return this.sha256(`${uid}|${seed}`);
	}

	private normalizeQuickAuthBaseUrl(raw?: string): string {
		const fallback = "https://go.mynt.in/NorenWClientWeb";
		const candidate = this.pickFirstString(raw);
		if (!candidate) return fallback;

		try {
			const u = new URL(candidate);
			const host = u.hostname.toLowerCase();

			if (["api.mynt.in", "mynt.in", "api.zebull.in", "zebull.in"].includes(host)) {
				return fallback;
			}

			if (host === "go.mynt.in") {
				return `${u.protocol}//go.mynt.in/NorenWClientWeb`;
			}

			const normalizedPath = u.pathname && u.pathname !== "/" ? u.pathname.replace(/\/+$/, "") : "";
			return `${u.protocol}//${u.host}${normalizedPath}`;
		} catch {
			return fallback;
		}
	}

	private async requestTokenWithPasswordAndTotp(
		account: any,
		password: string,
		totp: string
	): Promise<{
		baseUrl: string;
		clientId: string;
		apiKey?: string;
		apiSecret?: string;
		accessToken: string;
		refreshToken?: string;
		expiresAt?: string;
		raw: any;
	}> {
		const meta = this.asObject(account?.accountMeta);
		const zebu = this.asObject(meta.zebu);

		const baseUrl = this.normalizeQuickAuthBaseUrl(this.pickFirstString(
			zebu.baseUrl,
			process.env.ZEBU_BASE_URL,
			"https://go.mynt.in/NorenWClientWeb"
		));
		const rawUid = this.pickFirstString(zebu.uid, zebu.clientId, zebu.accountId, account?.accountId);
		const uid = this.normalizeNorenUid(rawUid);
		const vc = "NOREN_WEB";
		const source = "WEB";
		const imei = this.pickFirstString(zebu.imei, process.env.ZEBU_IMEI, "abcd1234") as string;
		const apkversion = this.pickFirstString(zebu.apkversion, process.env.ZEBU_APKVERSION, "1.0.0") as string;

		if (!uid) {
			throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "zebu_credentials_missing" };
		}

		const url = `${baseUrl.replace(/\/+$/, "")}/QuickAuth`;

		const uidCandidates = Array.from(new Set([
			uid,
			String(rawUid ?? "").trim(),
		].filter(Boolean)));
		const metaAppKey = this.pickFirstString(zebu.appKey, zebu.apiSecret)?.replace(/[^a-fA-F0-9]/g, "").toLowerCase();

		let responseBody: any = null;
		let finalStatus = 0;

		for (const uidCandidate of uidCandidates) {
			const appkeyCandidates = Array.from(new Set([
				this.resolveAppKey(uidCandidate).replace(/[^a-fA-F0-9]/g, "").toLowerCase(),
				metaAppKey,
			].filter(Boolean as any))) as string[];

			for (const appkey of appkeyCandidates) {
				const jData = {
					uid: uidCandidate,
					pwd: this.sha256(password),
					factor2: totp,
					imei,
					apkversion,
					vc,
					appkey,
					source,
				};

				const payloadJson = JSON.stringify(jData);
				const bodyVariants = [
					{ label: "urlencoded", body: `jData=${encodeURIComponent(payloadJson)}` },
					{ label: "raw-json", body: `jData=${payloadJson}` },
				];

				for (const variant of bodyVariants) {
					console.info("[ZEBU][QuickAuth] attempt", {
						url,
						uid: jData.uid,
						vc: jData.vc,
						source: jData.source,
						appkey: jData.appkey,
						imei: jData.imei,
						apkversion: jData.apkversion,
						pwd: `sha256:${String(jData.pwd).slice(0, 8)}...`,
						factor2: `***${String(jData.factor2).slice(-2)}`,
						bodyMode: variant.label,
					});

					const res = await fetch(url, {
						method: "POST",
						headers: {
							"content-type": "application/x-www-form-urlencoded",
							accept: "application/json",
						},
						body: variant.body,
					});

					const responseText = await res.text();
					finalStatus = res.status;
					responseBody = responseText;
					try {
						responseBody = JSON.parse(responseText);
					} catch {
						// keep raw text
					}

					if (res.ok && String(responseBody?.stat ?? "") === "Ok") {
						break;
					}

					const emsg = String(responseBody?.emsg ?? "").toLowerCase();
					const retryable =
						emsg.includes("jdata is not valid json object") ||
						emsg.includes("invalid app key") ||
						emsg.includes("invalid user");
					if (!retryable) {
						throw {
							statusCode: HttpStatusCode._BAD_GATEWAY,
							message: "zebu_token_generation_failed",
							data: {
								status: res.status,
								payload: responseBody,
								url,
							},
						};
					}
				}

				if (String(responseBody?.stat ?? "") === "Ok") {
					break;
				}
			}

			if (String(responseBody?.stat ?? "") === "Ok") {
				break;
			}
		}

		if (String(responseBody?.stat ?? "") !== "Ok") {
			throw {
				statusCode: HttpStatusCode._BAD_GATEWAY,
				message: "zebu_token_generation_failed",
				data: {
					status: finalStatus,
					payload: responseBody,
					url,
				},
			};
		}

		const accessToken = this.pickFirstString(responseBody?.susertoken, responseBody?.token, responseBody?.jwtToken);
		if (!accessToken) {
			throw {
				statusCode: HttpStatusCode._BAD_GATEWAY,
				message: "zebu_access_token_missing_in_response",
				data: { payload: responseBody, url },
			};
		}

		return {
			baseUrl: baseUrl.replace(/\/+$/, ""),
			clientId: uid,
			apiKey: this.pickFirstString(zebu.apiKey),
			apiSecret: this.pickFirstString(zebu.apiSecret),
			accessToken,
			refreshToken: undefined,
			expiresAt: undefined,
			raw: responseBody,
		};
	}

	private getZebuConfigFromAccount(account: any): ZebuConfig {
		const meta = this.asObject(account?.accountMeta);
		const zebu = this.asObject(meta?.zebu);

		const baseUrl = String(zebu.baseUrl ?? process.env.ZEBU_BASE_URL ?? "").trim();
		const accessToken = String(zebu.accessToken ?? account?.accessToken ?? "").trim();
		const apiKey = String(zebu.apiKey ?? "").trim() || undefined;
		const uid = this.normalizeNorenUid(this.pickFirstString(zebu.uid, zebu.clientId, zebu.accountId, account?.accountId));
		const actid = this.normalizeNorenUid(this.pickFirstString(zebu.actid, zebu.accountId, zebu.clientId, account?.accountId));

		if (!baseUrl) {
			throw {
				statusCode: HttpStatusCode._BAD_REQUEST,
				message: "zebu_base_url_missing",
			};
		}

		if (!accessToken) {
			throw {
				statusCode: HttpStatusCode._BAD_REQUEST,
				message: "zebu_access_token_missing",
			};
		}

		return { baseUrl, accessToken, apiKey, uid, actid: actid ?? uid };
	}

	private isNorenBase(baseUrl: string): boolean {
		return /NorenWClientWeb/i.test(baseUrl) || /go\.mynt\.in/i.test(baseUrl);
	}

	private mapOrderTypeForNoren(orderType?: string): string {
		const t = String(orderType ?? "MARKET").toUpperCase();
		if (t === "LIMIT") return "LMT";
		if (t.includes("SL") && t.includes("M")) return "SL-MKT";
		if (t.includes("SL")) return "SL-LMT";
		return "MKT";
	}

	private mapProductForNoren(product?: string): string {
		const p = String(product ?? "C").toUpperCase();
		if (["MIS", "I", "INTRADAY"].includes(p)) return "I";
		if (["NRML", "M", "MARGIN"].includes(p)) return "M";
		return "C";
	}

	private async zebuRequest(
		config: ZebuConfig,
		method: "GET" | "POST",
		path: string,
		body?: any
	) {
		if (this.isNorenBase(config.baseUrl)) {
			const routeMap: Record<string, string> = {
				"orders/place": "PlaceOrder",
				"orders/modify": "ModifyOrder",
				"orders/cancel": "CancelOrder",
				"orders": "OrderBook",
				"positions": "PositionBook",
				"holdings": "Holdings",
			};

			const mapped = routeMap[path] ?? path;
			const norenUrl = `${config.baseUrl.replace(/\/+$/, "")}/${mapped.replace(/^\/+/, "")}`;
			const uid = config.uid;
			const actid = config.actid ?? config.uid;
			if (!uid) {
				throw {
					statusCode: HttpStatusCode._BAD_REQUEST,
					message: "zebu_uid_missing",
				};
			}

			let jData: Record<string, any> = { uid };
			if (actid) jData.actid = actid;

			if (mapped === "PlaceOrder") {
				jData = {
					...jData,
					exch: String(body?.exchange ?? "NSE").toUpperCase(),
					tsym: String(body?.symbol ?? "").trim(),
					qty: String(Number(body?.quantity ?? 0)),
					prc: String(Number(body?.price ?? 0)),
					trgprc: String(Number(body?.triggerPrice ?? 0)),
					trantype: String(body?.side ?? "BUY").toUpperCase().startsWith("S") ? "S" : "B",
					prd: this.mapProductForNoren(body?.product),
					prctyp: this.mapOrderTypeForNoren(body?.orderType),
					ret: String(body?.validity ?? "DAY").toUpperCase(),
				};
			}

			if (mapped === "ModifyOrder") {
				jData = {
					...jData,
					norenordno: String(body?.orderId ?? "").trim(),
					qty: body?.quantity != null ? String(Number(body.quantity)) : undefined,
					prc: body?.price != null ? String(Number(body.price)) : undefined,
					trgprc: body?.triggerPrice != null ? String(Number(body.triggerPrice)) : undefined,
				};
			}

			if (mapped === "CancelOrder") {
				jData = {
					...jData,
					norenordno: String(body?.orderId ?? "").trim(),
				};
			}

			Object.keys(jData).forEach((k) => jData[k] === undefined && delete jData[k]);

			const form = new URLSearchParams();
			form.set("jData", JSON.stringify(jData));
			form.set("jKey", config.accessToken);

			const res = await fetch(norenUrl, {
				method: "POST",
				headers: {
					"content-type": "application/x-www-form-urlencoded",
					accept: "application/json",
				},
				body: form.toString(),
			});

			const responseText = await res.text();
			let payload: any = responseText;
			try {
				payload = JSON.parse(responseText);
			} catch {
				// keep raw
			}

			if (!res.ok || String(payload?.stat ?? "") === "Not_Ok") {
				throw {
					statusCode: HttpStatusCode._BAD_GATEWAY,
					message: "zebu_upstream_failed",
					data: { status: res.status, payload },
				};
			}

			return payload;
		}

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
				message: "zebu_upstream_failed",
				data: { status: res.status, payload },
			};
		}

		return payload;
	}

	async saveAuthToken(payload: ZebuAuthPayload) {
		const account = await this.db.getTradingAccountById(payload.userId, payload.tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}
		const existingMeta = this.asObject(account.accountMeta);
		const existingZebu = this.asObject(existingMeta.zebu);

		const nextMeta = {
			zebu: {
				...existingZebu,
				accessToken: payload.accessToken,
				baseUrl: payload.baseUrl ?? existingZebu.baseUrl,
				apiKey: payload.apiKey ?? existingZebu.apiKey,
				updatedAt: new Date().toISOString(),
			},
		};

		if (account.status !== TradingAccountStatus.VERIFIED) {
			account.status = TradingAccountStatus.VERIFIED;
		}
		account.accessToken = payload.accessToken;

		await this.db.updateAccountMeta(account, nextMeta);

		return { ok: true };
	}

	async generateAndSaveTokenUsingTotp(payload: ZebuGenerateTokenRequest) {
		const account = await this.db.getTradingAccountById(payload.userId, payload.tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}

		const generated = await this.requestTokenWithPasswordAndTotp(account, payload.password, payload.totp);
		const existingMeta = this.asObject(account.accountMeta);
		const existingZebu = this.asObject(existingMeta.zebu);

		const nextMeta = {
			zebu: {
				...existingZebu,
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
		account.accessToken = generated.accessToken;
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

	private buildOrderFromSignal(signal: TradeSignal): ZebuOrderPayload {
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

	async placeOrder(req: ZebuPlaceOrderRequest) {
		const account = await this.db.getTradingAccountById(req.userId, req.tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}

		const cfg = this.getZebuConfigFromAccount(account);

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

		const data = await this.zebuRequest(cfg, "POST", "orders/place", payload);

		const orderId =
			data?.data?.order_id || data?.data?.orderId || data?.order_id || data?.orderId || null;

		return { orderId: orderId ? String(orderId) : null, raw: data };
	}

	async modifyOrder(req: ZebuModifyOrderRequest) {
		const account = await this.db.getTradingAccountById(req.userId, req.tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}

		const cfg = this.getZebuConfigFromAccount(account);

		const payload: Record<string, any> = { orderId: req.orderId };
		if (typeof req.quantity === "number") payload.quantity = req.quantity;
		if (typeof req.price === "number") payload.price = req.price;
		if (typeof req.triggerPrice === "number") payload.triggerPrice = req.triggerPrice;
		if (req.validity) payload.validity = req.validity;

		const data = await this.zebuRequest(cfg, "POST", "orders/modify", payload);
		return { orderId: req.orderId, raw: data };
	}

	async cancelOrder(req: ZebuCancelOrderRequest) {
		const account = await this.db.getTradingAccountById(req.userId, req.tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}

		const cfg = this.getZebuConfigFromAccount(account);
		const data = await this.zebuRequest(cfg, "POST", "orders/cancel", { orderId: req.orderId });
		return { orderId: req.orderId, raw: data };
	}

	async getOrders(userId: number, tradingAccountId: number) {
		const account = await this.db.getTradingAccountById(userId, tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}

		const cfg = this.getZebuConfigFromAccount(account);
		const data = await this.zebuRequest(cfg, "GET", "orders");
		return data;
	}

	async getPositions(userId: number, tradingAccountId: number) {
		const account = await this.db.getTradingAccountById(userId, tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}

		const cfg = this.getZebuConfigFromAccount(account);
		const data = await this.zebuRequest(cfg, "GET", "positions");
		return data;
	}

	async getHoldings(userId: number, tradingAccountId: number) {
		const account = await this.db.getTradingAccountById(userId, tradingAccountId);
		if (!account) {
			throw { statusCode: HttpStatusCode._NOT_FOUND, message: "trading_account_not_found" };
		}

		const cfg = this.getZebuConfigFromAccount(account);
		const data = await this.zebuRequest(cfg, "GET", "holdings");
		return data;
	}

	async executePendingBatch(opts?: ZebuBatchRequest) {
		const batchSize = opts?.batchSize ?? Number(process.env.ZEBU_EXEC_BATCH_SIZE ?? 25);
		const trades = await this.db.claimPendingTrades(batchSize);
		if (!trades.length) return { ok: true, processed: 0 };

		const updates: { id: number; status: string; error?: string }[] = [];

		for (const t of trades) {
			try {
				if (!t.tradingAccount) {
					updates.push({ id: t.id, status: "failed", error: "missing_trading_account" });
					continue;
				}

				const cfg = this.getZebuConfigFromAccount(t.tradingAccount as any);
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

				await this.zebuRequest(cfg, "POST", "orders/place", payload);
				updates.push({ id: t.id, status: "executed" });
			} catch (e: any) {
				updates.push({ id: t.id, status: "failed", error: e?.message ?? String(e) });
			}
		}

		await this.db.updateTradeStatus(updates);
		return { ok: true, processed: trades.length };
	}
}
