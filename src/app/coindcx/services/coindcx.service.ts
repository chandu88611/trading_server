import axios, { AxiosRequestConfig } from "axios";
import crypto from "crypto";
import { CoinDCXDB } from "./coindcx.db";
import {
	CoinDCXAuthPayload,
	CoinDCXBatchRequest,
	CoinDCXCancelOrderRequest,
	CoinDCXDeleteTokenResult,
	CoinDCXModifyOrderRequest,
	CoinDCXOrderPayload,
	CoinDCXPlaceOrderRequest,
	CoinDCXPublicOrderbookRequest,
	CoinDCXPublicTickerRequest,
	CoinDCXTokenStatus,
	CoinDCXVerifyTokenResult,
	CoinDCXFuturesCreateTPSLRequest,
	CoinDCXFuturesInstrumentRequest,
	CoinDCXFuturesPlaceOrderRequest,
	CoinDCXFuturesPositionActionRequest,
	CoinDCXFuturesPositionsRequest,
	CoinDCXFuturesTPSLOrder,
} from "../interfaces/coindcx";

type CoinDCXCredentials = {
	apiKey: string;
	apiSecret: string;
	baseUrl: string;
	connectedAt?: string | null;
	verifiedAt?: string | null;
};

type NormalizedCoinDCXMeta = {
	apiKey?: string;
	apiSecret?: string;
	baseUrl?: string;
	connectedAt?: string | null;
	verifiedAt?: string | null;
};

export class CoinDCXService {
	private readonly db = new CoinDCXDB();

	private readonly defaultBaseUrl =
		process.env.COINDCX_BASE_URL || "https://api.coindcx.com";

	private readonly requestTimeout = Number(process.env.COINDCX_TIMEOUT_MS || 15000);

	private readonly defaultBatchSize = Number(
		process.env.COINDCX_EXECUTE_BATCH_SIZE || 25
	);

	private readonly maxBatchSize = Number(
		process.env.COINDCX_EXECUTE_MAX_BATCH_SIZE || 100
	);

	async saveAuthToken(payload: CoinDCXAuthPayload) {
		const account = await this.db.getTradingAccountById(
			payload.userId,
			payload.tradingAccountId
		);

		if (!account) {
			this.throwError(404, "trading_account_not_found");
		}

		const baseUrl = this.cleanBaseUrl(payload.baseUrl || this.defaultBaseUrl);
		const now = new Date().toISOString();

		await this.db.updateAccountMeta(account!, {
			coindcx: {
				apiKey: payload.apiKey,
				apiSecret: payload.apiSecret,
				baseUrl,
				connectedAt: now,
				verifiedAt: null,
			},
		});

		return {
			tradingAccountId: payload.tradingAccountId,
			broker: this.getBrokerName(account),
			baseUrl,
			connectedAt: now,
			hasApiKey: true,
			hasApiSecret: true,
		};
	}

	async getAuthTokenStatus(
		userId: number,
		tradingAccountId: number
	): Promise<CoinDCXTokenStatus> {
		const account = await this.db.getTradingAccountById(userId, tradingAccountId);

		if (!account) {
			this.throwError(404, "trading_account_not_found");
		}

		const meta = this.getCoinDCXMeta(account!);

		const hasApiKey = Boolean(meta.apiKey);
		const hasApiSecret = Boolean(meta.apiSecret);

		return {
			tradingAccountId,
			broker: this.getBrokerName(account),
			hasApiKey,
			hasApiSecret,
			baseUrl: meta.baseUrl || this.defaultBaseUrl,
			connectedAt: meta.connectedAt || null,
			verifiedAt: meta.verifiedAt || null,
			isReady: hasApiKey && hasApiSecret,
		};
	}

	async verifyAuthToken(
		userId: number,
		tradingAccountId: number
	): Promise<CoinDCXVerifyTokenResult> {
		const checkedAt = new Date().toISOString();

		try {
			const account = await this.db.getTradingAccountById(
				userId,
				tradingAccountId
			);

			if (!account) {
				this.throwError(404, "trading_account_not_found");
			}

			const credentials = this.requireCredentials(account!);

			await this.privatePost(credentials, "/exchange/v1/users/balances", {
				timestamp: Date.now(),
			});

			await this.db.updateAccountMeta(account!, {
				coindcx: {
					...this.getCoinDCXMeta(account!),
					verifiedAt: checkedAt,
				},
			});

			return {
				valid: true,
				tradingAccountId,
				broker: this.getBrokerName(account),
				checkedAt,
			};
		} catch (error: any) {
			return {
				valid: false,
				tradingAccountId,
				broker: null,
				checkedAt,
				error: this.getErrorMessage(error),
			};
		}
	}

	async deleteAuthToken(
		userId: number,
		tradingAccountId: number
	): Promise<CoinDCXDeleteTokenResult> {
		const account = await this.db.getTradingAccountById(userId, tradingAccountId);

		if (!account) {
			this.throwError(404, "trading_account_not_found");
		}

		await this.db.clearAuthMeta(account!);

		return {
			deleted: true,
			tradingAccountId,
			broker: this.getBrokerName(account),
		};
	}

	// Existing CoinDCX Spot order flow.
	async placeOrder(request: CoinDCXPlaceOrderRequest) {
		const account = await this.db.getTradingAccountById(
			request.userId,
			request.tradingAccountId
		);

		if (!account) {
			this.throwError(404, "trading_account_not_found");
		}

		const credentials = this.requireCredentials(account!);
		const order = this.normalizeOrder(request.order);

		const body: Record<string, any> = {
			side: order.side.toLowerCase(),
			order_type: this.normalizeOrderType(order.orderType),
			market: this.normalizeMarket(order.symbol),
			total_quantity: String(order.quantity),
			timestamp: Date.now(),
		};

		if (order.price !== undefined && order.price !== null) {
			body.price_per_unit = String(order.price);
		}

		if (order.clientOrderId) {
			body.client_order_id = order.clientOrderId;
		}

		return this.privatePost(credentials, "/exchange/v1/orders/create", body);
	}

	// CoinDCX Futures/perpetual order flow.
	async placeFuturesOrder(request: CoinDCXFuturesPlaceOrderRequest) {
		const account = await this.db.getTradingAccountById(
			request.userId,
			request.tradingAccountId
		);

		if (!account) {
			this.throwError(404, "trading_account_not_found");
		}

		const credentials = this.requireCredentials(account);
		const order: any = request.order;

		if (!order) {
			this.throwError(400, "futures_order_required");
		}

		const pair = this.normalizeFuturesPair(order.symbol);
		const side = this.normalizeFuturesSide(order.side);
		const orderType = this.normalizeFuturesOrderType(order.orderType);

		if (!pair) {
			this.throwError(400, "futures_symbol_required");
		}

		const leverage = Number(order.leverage);

		if (!Number.isFinite(leverage) || leverage <= 0) {
			this.throwError(400, "valid_leverage_required");
		}

		const marginAmount = Number(
			order.marginAmount ??
				order.margin_amount ??
				order.margin ??
				order.capital
		);

		if (!Number.isFinite(marginAmount) || marginAmount <= 0) {
			this.throwError(400, "valid_margin_amount_required");
		}

		const requestedMarginCurrency = String(
			order.marginCurrency ??
				order.margin_currency_short_name ??
				"AUTO"
		)
			.trim()
			.toUpperCase();

		if (!["AUTO", "INR", "USDT"].includes(requestedMarginCurrency)) {
			this.throwError(400, "invalid_margin_currency");
		}

		const requestedPositionMarginType = String(
			order.positionMarginType ??
				order.position_margin_type ??
				"isolated"
		)
			.trim()
			.toLowerCase();

		if (!["isolated", "crossed"].includes(requestedPositionMarginType)) {
			this.throwError(400, "invalid_position_margin_type");
		}

		if (
			orderType === "limit_order" &&
			(!Number.isFinite(Number(order.price)) || Number(order.price) <= 0)
		) {
			this.throwError(400, "price_required_for_limit_order");
		}

		const balances = await this.getFuturesAvailableBalances(credentials);

		const marginCurrencyAttempts: Array<"INR" | "USDT"> = [];

		const addCurrencyAttempt = (currency: "INR" | "USDT") => {
			const availableBalance =
				currency === "INR" ? balances.inrAvailable : balances.usdtAvailable;

			if (availableBalance > 0 && !marginCurrencyAttempts.includes(currency)) {
				marginCurrencyAttempts.push(currency);
			}
		};

		if (requestedMarginCurrency === "USDT") {
			addCurrencyAttempt("USDT");
			addCurrencyAttempt("INR");
		} else if (requestedMarginCurrency === "INR") {
			addCurrencyAttempt("INR");
			addCurrencyAttempt("USDT");
		} else {
			addCurrencyAttempt("INR");
			addCurrencyAttempt("USDT");
		}

		if (!marginCurrencyAttempts.length) {
			this.throwError(
				400,
				JSON.stringify({
					message: "insufficient_futures_wallet_balance",
					detectedBalances: {
						INR: balances.inrAvailable,
						USDT: balances.usdtAvailable,
					},
				})
			);
		}

		const failedAttempts: Array<{
			marginCurrency: "INR" | "USDT";
			positionMarginType: string;
			availableBalance: number;
			marginAmount: number;
			leverage: number;
			quantity?: number;
			error: string;
		}> = [];

		for (let index = 0; index < marginCurrencyAttempts.length; index++) {
			const marginCurrency = marginCurrencyAttempts[index];

			const availableBalance =
				marginCurrency === "INR"
					? balances.inrAvailable
					: balances.usdtAvailable;

			const positionMarginType =
				marginCurrency === "INR" ? "isolated" : requestedPositionMarginType;

			if (marginAmount > availableBalance) {
				failedAttempts.push({
					marginCurrency,
					positionMarginType,
					availableBalance,
					marginAmount,
					leverage,
					error: "margin_amount_exceeds_available_balance",
				});
				continue;
			}

			const pricing = await this.resolveFuturesPricing({
				pair,
				order,
				orderType,
				marginCurrency,
			});

			const quantityInfo = this.calculateFuturesQuantity({
				marginAmount,
				leverage,
				entryPrice: pricing.entryPrice,
				marginCurrency,
				usdtInrRate: pricing.usdtInrRate,
			});

			if (!Number.isFinite(quantityInfo.quantity) || quantityInfo.quantity <= 0) {
				this.throwError(400, "invalid_calculated_quantity");
			}

			const minQuantity = Number(process.env.COINDCX_FUTURES_MIN_QTY || 0.001);

			if (!Number.isFinite(minQuantity) || minQuantity <= 0) {
				this.throwError(500, "invalid_min_quantity_config");
			}

			if (quantityInfo.quantity < minQuantity) {
				const requiredMargin = this.calculateRequiredMarginForMinQuantity({
					minQuantity,
					entryPrice: pricing.entryPrice,
					leverage,
					marginCurrency,
					usdtInrRate: pricing.usdtInrRate,
				});

				this.throwError(
					400,
					JSON.stringify({
						message: "minimum_quantity_not_met",
						minQuantity,
						quantityStep: Number(process.env.COINDCX_FUTURES_QTY_STEP || 0.001),
						calculatedQuantity: quantityInfo.quantity,
						rawQuantity: quantityInfo.rawQuantity,
						marginAmount,
						leverage,
						requiredMargin,
						suggestion: `Use marginAmount >= ${requiredMargin} or increase leverage.`,
					})
				);
			}

			const tpsl = this.calculateFuturesTPSL({
				side,
				entryPrice: pricing.entryPrice,
				stopLossPrice:
					order.stopLossPrice ??
					order.stop_loss_price ??
					order.stopLoss,
				takeProfitPrice:
					order.takeProfitPrice ??
					order.take_profit_price ??
					order.takeProfit,
				stopLossPercent:
					order.stopLossPercent ??
					order.stop_loss_percent ??
					order.slPercent,
				takeProfitPercent:
					order.takeProfitPercent ??
					order.take_profit_percent ??
					order.tpPercent,
			});

			const body: Record<string, any> = {
				timestamp: Date.now(),
				order: {
					side,
					pair,
					order_type: orderType,
					total_quantity: quantityInfo.quantity,
					leverage,
					margin_currency_short_name: marginCurrency,
					position_margin_type: positionMarginType,
					notification: order.notification ?? "no_notification",
					hidden: false,
					post_only: false,
				},
			};

			if (order.clientOrderId || order.client_order_id) {
				body.order.client_order_id = order.clientOrderId ?? order.client_order_id;
			}

			if (orderType !== "market_order") {
				body.order.time_in_force =
					order.timeInForce ??
					order.time_in_force ??
					"good_till_cancel";

				body.order.price = pricing.entryPrice;
			}

			if (tpsl.takeProfitPrice) {
				body.order.take_profit_price = tpsl.takeProfitPrice;
			}

			if (tpsl.stopLossPrice) {
				body.order.stop_loss_price = tpsl.stopLossPrice;
			}

			console.log(
				"Final CoinDCX futures order body:",
				JSON.stringify(
					{
						...body,
						calculation: {
							marginAmount,
							leverage,
							positionSizeInMarginCurrency:
								quantityInfo.positionSizeInMarginCurrency,
							positionSizeInUSDT: quantityInfo.positionSizeInUSDT,
							entryPrice: pricing.entryPrice,
							usdtInrRate: pricing.usdtInrRate,
							calculatedQuantity: quantityInfo.quantity,
							stopLossPrice: tpsl.stopLossPrice,
							takeProfitPrice: tpsl.takeProfitPrice,
						},
					},
					null,
					2
				)
			);

			try {
				const orderResult = await this.privatePost(
					credentials,
					"/exchange/v1/derivatives/futures/orders/create",
					body
				);

				return {
					order: orderResult,
					selectedWallet: {
						marginCurrency,
						positionMarginType,
						availableBalance,
					},
					calculation: {
						pair,
						side,
						orderType,
						marginAmount,
						leverage,
						positionSizeInMarginCurrency:
							quantityInfo.positionSizeInMarginCurrency,
						positionSizeInUSDT: quantityInfo.positionSizeInUSDT,
						entryPrice: pricing.entryPrice,
						usdtInrRate: pricing.usdtInrRate,
						quantity: quantityInfo.quantity,
						stopLossPrice: tpsl.stopLossPrice,
						takeProfitPrice: tpsl.takeProfitPrice,
					},
					request: {
						pair,
						side,
						orderType,
						marginAmount,
						leverage,
						marginCurrency,
						positionMarginType,
						price: body.order.price ?? null,
						totalQuantity: body.order.total_quantity,
						takeProfitPrice: body.order.take_profit_price ?? null,
						stopLossPrice: body.order.stop_loss_price ?? null,
					},
				};
			} catch (error: any) {
				const errorMessage = this.getErrorMessage(error);

				failedAttempts.push({
					marginCurrency,
					positionMarginType,
					availableBalance,
					marginAmount,
					leverage,
					quantity: quantityInfo.quantity,
					error: errorMessage,
				});

				const hasAnotherWallet = index < marginCurrencyAttempts.length - 1;

				if (this.isInsufficientFundsError(error) && hasAnotherWallet) {
					continue;
				}

				throw error;
			}
		}

		this.throwError(
			400,
			JSON.stringify({
				message: "futures_order_failed_for_all_funded_wallets",
				detectedBalances: {
					INR: balances.inrAvailable,
					USDT: balances.usdtAvailable,
				},
				attempts: failedAttempts,
			})
		);
	}

	async getFuturesWallets(userId: number, tradingAccountId: number) {
		const account = await this.db.getTradingAccountById(
			userId,
			tradingAccountId
		);

		if (!account) {
			this.throwError(404, "trading_account_not_found");
		}

		const credentials = this.requireCredentials(account!);

		return this.privateGet(
			credentials,
			"/exchange/v1/derivatives/futures/wallets",
			{
				timestamp: Date.now(),
			}
		);
	}

	async getFuturesPositions(request: CoinDCXFuturesPositionsRequest) {
		const account = await this.db.getTradingAccountById(
			request.userId,
			request.tradingAccountId
		);

		if (!account) {
			this.throwError(404, "trading_account_not_found");
		}

		const credentials = this.requireCredentials(account!);

		return this.privatePost(
			credentials,
			"/exchange/v1/derivatives/futures/positions",
			{
				timestamp: Date.now(),
				page: String(request.page || 1),
				size: String(request.size || 10),
			}
		);
	}

	async createFuturesTPSL(request: CoinDCXFuturesCreateTPSLRequest) {
		const account = await this.db.getTradingAccountById(
			request.userId,
			request.tradingAccountId
		);

		if (!account) {
			this.throwError(404, "trading_account_not_found");
		}

		if (!request.positionId) {
			this.throwError(400, "positionId_required");
		}

		if (!request.stopLoss && !request.takeProfit) {
			this.throwError(400, "stopLoss_or_takeProfit_required");
		}

		const credentials = this.requireCredentials(account!);

		const body: Record<string, any> = {
			timestamp: Date.now(),
			id: request.positionId,
		};

		if (request.takeProfit) {
			body.take_profit = this.normalizeTakeProfit(request.takeProfit);
		}

		if (request.stopLoss) {
			body.stop_loss = this.normalizeStopLoss(request.stopLoss);
		}

		return this.privatePost(
			credentials,
			"/exchange/v1/derivatives/futures/positions/create_tpsl",
			body
		);
	}

	async exitFuturesPosition(request: CoinDCXFuturesPositionActionRequest) {
		const account = await this.db.getTradingAccountById(
			request.userId,
			request.tradingAccountId
		);

		if (!account) {
			this.throwError(404, "trading_account_not_found");
		}

		if (!request.positionId) {
			this.throwError(400, "positionId_required");
		}

		const credentials = this.requireCredentials(account!);

		return this.privatePost(
			credentials,
			"/exchange/v1/derivatives/futures/positions/exit",
			{
				timestamp: Date.now(),
				id: request.positionId,
			}
		);
	}

	async cancelFuturesOpenOrdersForPosition(
		request: CoinDCXFuturesPositionActionRequest
	) {
		const account = await this.db.getTradingAccountById(
			request.userId,
			request.tradingAccountId
		);

		if (!account) {
			this.throwError(404, "trading_account_not_found");
		}

		if (!request.positionId) {
			this.throwError(400, "positionId_required");
		}

		const credentials = this.requireCredentials(account!);

		return this.privatePost(
			credentials,
			"/exchange/v1/derivatives/futures/positions/cancel_all_open_orders_for_position",
			{
				timestamp: Date.now(),
				id: request.positionId,
			}
		);
	}

	async getFuturesInstruments(request: CoinDCXFuturesInstrumentRequest) {
		const input: any = request;

		const pair = String(input?.pair ?? "").trim();

		const marginCurrency = String(
			input?.marginCurrency ??
				input?.margin_currency_short_name ??
				"INR"
		)
			.trim()
			.toUpperCase();

		if (!["INR", "USDT"].includes(marginCurrency)) {
			this.throwError(400, "invalid_margin_currency");
		}

		const query: Record<string, any> = {
			margin_currency_short_name: marginCurrency,
		};

		if (pair) {
			query.pair = this.normalizeFuturesPair(pair);

			return this.publicGet(
				"/exchange/v1/derivatives/futures/data/instrument",
				query
			);
		}

		return this.publicGet(
			"/exchange/v1/derivatives/futures/data/active_instruments",
			query
		);
	}

	async modifyOrder(request: CoinDCXModifyOrderRequest) {
		const account = await this.db.getTradingAccountById(
			request.userId,
			request.tradingAccountId
		);

		if (!account) {
			this.throwError(404, "trading_account_not_found");
		}

		const credentials = this.requireCredentials(account!);

		const body: Record<string, any> = {
			id: request.orderId,
			timestamp: Date.now(),
		};

		if (request.quantity !== undefined && request.quantity !== null) {
			const quantity = Number(request.quantity);

			if (!Number.isFinite(quantity) || quantity <= 0) {
				this.throwError(400, "invalid_quantity");
			}

			body.total_quantity = String(quantity);
		}

		if (request.price !== undefined && request.price !== null) {
			const price = Number(request.price);

			if (!Number.isFinite(price) || price <= 0) {
				this.throwError(400, "invalid_price");
			}

			body.price_per_unit = String(price);
		}

		if (!body.total_quantity && !body.price_per_unit) {
			this.throwError(400, "quantity_or_price_required");
		}

		return this.privatePost(credentials, "/exchange/v1/orders/edit", body);
	}

	async cancelOrder(request: CoinDCXCancelOrderRequest) {
		const account = await this.db.getTradingAccountById(
			request.userId,
			request.tradingAccountId
		);

		if (!account) {
			this.throwError(404, "trading_account_not_found");
		}

		const credentials = this.requireCredentials(account!);

		return this.privatePost(credentials, "/exchange/v1/orders/cancel", {
			id: request.orderId,
			timestamp: Date.now(),
		});
	}

	async getOrders(userId: number, tradingAccountId: number) {
		const account = await this.db.getTradingAccountById(userId, tradingAccountId);

		if (!account) {
			this.throwError(404, "trading_account_not_found");
		}

		const credentials = this.requireCredentials(account!);

		const activeOrders = await this.privatePost(
			credentials,
			"/exchange/v1/orders/active_orders",
			{
				timestamp: Date.now(),
			}
		);

		return {
			activeOrders,
		};
	}

	async getPositions(userId: number, tradingAccountId: number) {
		const account = await this.db.getTradingAccountById(userId, tradingAccountId);

		if (!account) {
			this.throwError(404, "trading_account_not_found");
		}

		const credentials = this.requireCredentials(account!);

		const balances = await this.privatePost(
			credentials,
			"/exchange/v1/users/balances",
			{
				timestamp: Date.now(),
			}
		);

		return {
			message:
				"CoinDCX spot account does not have futures-style positions. Use /coindcx/futures/positions for perpetual futures.",
			balances: this.filterNonZeroBalances(balances),
		};
	}

	async getHoldings(userId: number, tradingAccountId: number) {
		const account = await this.db.getTradingAccountById(userId, tradingAccountId);

		if (!account) {
			this.throwError(404, "trading_account_not_found");
		}

		const credentials = this.requireCredentials(account!);

		const balances = await this.privatePost(
			credentials,
			"/exchange/v1/users/balances",
			{
				timestamp: Date.now(),
			}
		);

		return this.filterNonZeroBalances(balances);
	}

	async executePendingBatch(request: CoinDCXBatchRequest) {
		const batchSize = this.normalizeBatchSize(request.batchSize);
		const jobs = await this.db.claimPendingTrades(batchSize);

		const result = {
			picked: jobs.length,
			completed: 0,
			failed: 0,
			items: [] as any[],
		};

		for (const job of jobs as any[]) {
			try {
				const tradingAccount = job.tradingAccount;

				if (!tradingAccount?.userId || !tradingAccount?.id) {
					this.throwError(400, "trade_signal_missing_trading_account");
				}

				const order = this.buildOrderFromTradeSignal(job);

				const orderResult: any = await this.placeOrder({
					userId: Number(tradingAccount.userId),
					tradingAccountId: Number(tradingAccount.id),
					order,
				});

				const brokerOrderId = this.extractBrokerOrderId(orderResult);

				await this.db.markJobSuccess(job, brokerOrderId);

				result.completed += 1;
				result.items.push({
					id: job.id,
					status: "completed",
					brokerOrderId,
					response: orderResult,
				});
			} catch (error: any) {
				const message = this.getErrorMessage(error);

				await this.db.markJobFailed(job as any, message);

				result.failed += 1;
				result.items.push({
					id: (job as any)?.id,
					status: "failed",
					error: message,
				});
			}
		}

		return result;
	}

	async getPublicTicker(request: CoinDCXPublicTickerRequest) {
		const data = await this.publicGet("/exchange/ticker");

		const market = request.market
			? this.normalizeMarket(request.market).toUpperCase()
			: undefined;

		if (!market) {
			return data;
		}

		if (Array.isArray(data)) {
			return data.filter((item: any) => {
				const itemMarket = String(
					item?.market ?? item?.symbol ?? item?.pair ?? ""
				).toUpperCase();

				return itemMarket === market;
			});
		}

		return data;
	}

	async getPublicOrderbook(request: CoinDCXPublicOrderbookRequest) {
		const market = this.normalizeMarket(request.market);

		return this.publicGet("/exchange/orderbook", {
			market,
		});
	}

	async getBalances(userId: number, tradingAccountId: number) {
		const account = await this.db.getTradingAccountById(userId, tradingAccountId);

		if (!account) {
			this.throwError(404, "trading_account_not_found");
		}

		const credentials = this.requireCredentials(account);

		return this.privatePost(credentials, "/exchange/v1/users/balances", {
			timestamp: Date.now(),
		});
	}

	async getAccountSummary(userId: number, tradingAccountId: number) {
		const profile = await this.db.getTradingAccountProfile(
			userId,
			tradingAccountId
		);

		if (!profile) {
			this.throwError(404, "trading_account_not_found");
		}

		const account = await this.db.getTradingAccountById(userId, tradingAccountId);

		if (!account) {
			this.throwError(404, "trading_account_not_found");
		}

		const credentials = this.requireCredentials(account);

		const rawBalances = await this.privatePost(
			credentials,
			"/exchange/v1/users/balances",
			{
				timestamp: Date.now(),
			}
		);

		const balances = this.normalizeBalances(rawBalances);
		const holdings = balances.filter((item) => item.totalBalance > 0);

		let activeOrders: any[] = [];
		let ordersError: string | null = null;

		try {
			const ordersResponse = await this.privatePost(
				credentials,
				"/exchange/v1/orders/active_orders",
				{
					timestamp: Date.now(),
				}
			);

			activeOrders = Array.isArray(ordersResponse)
				? ordersResponse
				: Array.isArray(ordersResponse?.orders)
					? ordersResponse.orders
					: [];
		} catch (error: any) {
			ordersError = this.getErrorMessage(error);
			activeOrders = [];
		}

		const accountMeta = profile.account_meta ?? {};
		const coindcxMeta =
			accountMeta.coindcx ??
			accountMeta.coinDCX ??
			accountMeta.coinDcx ??
			{};

		const totalAvailableBalance = balances.reduce(
			(sum, item) => sum + item.balance,
			0
		);

		const totalLockedBalance = balances.reduce(
			(sum, item) => sum + item.lockedBalance,
			0
		);

		let futuresPositions: any = null;
		let futuresPositionsError: string | null = null;

		try {
			futuresPositions = await this.getFuturesPositions({
				userId,
				tradingAccountId,
				page: 1,
				size: 20,
			});
		} catch (error: any) {
			futuresPositionsError = this.getErrorMessage(error);
		}

		return {
			user: {
				id: Number(profile.user_id ?? userId),
				name: profile.user_name ?? null,
				email: profile.user_email ?? null,
			},
			tradingAccount: {
				id: Number(profile.id ?? tradingAccountId),
				broker: profile.broker_code ?? "COINDCX",
				brokerName: profile.broker_name ?? "CoinDCX",
				marketCategory: profile.market_category ?? "CRYPTO",
				accountId: profile.account_id ?? null,
				accountLabel: profile.account_label ?? null,
				status: profile.status ?? null,
				isEnabled: profile.is_enabled ?? null,
				isMaster: profile.is_master ?? null,
				executionFlow: profile.execution_flow ?? null,
				lastVerifiedAt: profile.last_verified_at ?? null,
				createdAt: profile.created_at ?? null,
				updatedAt: profile.updated_at ?? null,
				coindcxClientId: coindcxMeta.clientId ?? null,
				coindcxAccountId: coindcxMeta.accountId ?? null,
				connectedAt: coindcxMeta.connectedAt ?? null,
				verifiedAt: coindcxMeta.verifiedAt ?? null,
			},
			balances,
			holdings,
			orders: {
				activeOrders,
				activeOrdersCount: activeOrders.length,
				error: ordersError,
			},
			futures: {
				positions: futuresPositions,
				error: futuresPositionsError,
			},
			summary: {
				totalAssets: balances.length,
				nonZeroAssets: holdings.length,
				hasFunds: holdings.length > 0,
				totalAvailableBalance,
				totalLockedBalance,
			},
			pnl: {
				spot: {
					available: false,
					realized: null,
					unrealized: null,
					total: null,
					reason:
						"CoinDCX spot P&L requires trade history and average buy price calculation",
				},
				futures: {
					available: !futuresPositionsError,
					source: "CoinDCX futures positions",
				},
			},
		};
	}

	private async publicGet(path: string, query?: Record<string, any>) {
		const config: AxiosRequestConfig = {
			method: "GET",
			url: `${this.defaultBaseUrl}${path}`,
			params: query,
			timeout: this.requestTimeout,
		};

		const response = await axios(config);
		return response.data;
	}

	private async privateGet(
		credentials: CoinDCXCredentials,
		path: string,
		body: Record<string, any>
	) {
		const finalBody = {
			...body,
			timestamp: body.timestamp || Date.now(),
		};

		const jsonBody = JSON.stringify(finalBody);

		const signature = crypto
			.createHmac("sha256", credentials.apiSecret)
			.update(jsonBody)
			.digest("hex");

		const config: AxiosRequestConfig = {
			method: "GET",
			url: `${credentials.baseUrl}${path}`,
			timeout: this.requestTimeout,
			headers: {
				"Content-Type": "application/json",
				"X-AUTH-APIKEY": credentials.apiKey,
				"X-AUTH-SIGNATURE": signature,
			},
			data: finalBody,
		};

		try {
			const response = await axios(config);
			return response.data;
		} catch (error: any) {
			const statusCode = error?.response?.status || 500;
			const brokerError =
				error?.response?.data?.message ||
				error?.response?.data?.error ||
				error?.response?.data ||
				error?.message ||
				"coindcx_request_failed";

			this.throwError(
				statusCode,
				typeof brokerError === "string"
					? brokerError
					: JSON.stringify(brokerError)
			);
		}
	}

	private async privatePost(
		credentials: CoinDCXCredentials,
		path: string,
		body: Record<string, any>
	) {
		const finalBody = {
			...body,
			timestamp: body.timestamp || Date.now(),
		};

		const jsonBody = JSON.stringify(finalBody);

		const signature = crypto
			.createHmac("sha256", credentials.apiSecret)
			.update(jsonBody)
			.digest("hex");

		const config: AxiosRequestConfig = {
			method: "POST",
			url: `${credentials.baseUrl}${path}`,
			timeout: this.requestTimeout,
			headers: {
				"Content-Type": "application/json",
				"X-AUTH-APIKEY": credentials.apiKey,
				"X-AUTH-SIGNATURE": signature,
			},
			data: finalBody,
		};

		try {
			const response = await axios(config);
			return response.data;
		} catch (error: any) {
			const statusCode = error?.response?.status || 500;
			const brokerError =
				error?.response?.data?.message ||
				error?.response?.data?.error ||
				error?.response?.data ||
				error?.message ||
				"coindcx_request_failed";

			this.throwError(
				statusCode,
				typeof brokerError === "string"
					? brokerError
					: JSON.stringify(brokerError)
			);
		}
	}

	private requireCredentials(account: any): CoinDCXCredentials {
		const meta = this.getCoinDCXMeta(account);

		if (!meta.apiKey || !meta.apiSecret) {
			this.throwError(400, "coindcx_credentials_not_configured");
		}

		return {
			apiKey: String(meta.apiKey),
			apiSecret: String(meta.apiSecret),
			baseUrl: this.cleanBaseUrl(meta.baseUrl || this.defaultBaseUrl),
			connectedAt: meta.connectedAt || null,
			verifiedAt: meta.verifiedAt || null,
		};
	}

	private getCoinDCXMeta(account: any): NormalizedCoinDCXMeta {
		const accountMeta = account?.accountMeta ?? {};

		const coindcx =
			accountMeta.coindcx ??
			accountMeta.coinDCX ??
			accountMeta.coinDcx ??
			{};

		return {
			apiKey:
				coindcx.apiKey ??
				accountMeta.coindcxApiKey ??
				accountMeta.apiKey ??
				undefined,
			apiSecret:
				coindcx.apiSecret ??
				accountMeta.coindcxApiSecret ??
				accountMeta.apiSecret ??
				undefined,
			baseUrl:
				coindcx.baseUrl ??
				accountMeta.coindcxBaseUrl ??
				accountMeta.baseUrl ??
				this.defaultBaseUrl,
			connectedAt: coindcx.connectedAt ?? null,
			verifiedAt: coindcx.verifiedAt ?? null,
		};
	}

	private async getFuturesAvailableBalances(credentials: CoinDCXCredentials) {
		let futuresWalletResponse: any = null;

		try {
			futuresWalletResponse = await this.privateGet(
				credentials,
				"/exchange/v1/derivatives/futures/wallets",
				{
					timestamp: Date.now(),
				}
			);
		} catch {
			futuresWalletResponse = null;
		}

		let accountBalancesResponse: any = null;

		try {
			accountBalancesResponse = await this.privatePost(
				credentials,
				"/exchange/v1/users/balances",
				{
					timestamp: Date.now(),
				}
			);
		} catch {
			accountBalancesResponse = null;
		}

		const futuresWallets = this.extractResponseArray(futuresWalletResponse);
		const accountBalances = this.extractResponseArray(accountBalancesResponse);

		const futuresInrAvailable = this.sumAvailableBalance(futuresWallets, "INR");
		const futuresUsdtAvailable = this.sumAvailableBalance(futuresWallets, "USDT");

		const accountInrAvailable = this.sumAvailableBalance(accountBalances, "INR");
		const accountUsdtAvailable = this.sumAvailableBalance(accountBalances, "USDT");

		const inrAvailable =
			futuresInrAvailable > 0 ? futuresInrAvailable : accountInrAvailable;

		const usdtAvailable =
			futuresUsdtAvailable > 0 ? futuresUsdtAvailable : accountUsdtAvailable;

		console.log("CoinDCX detected futures balances:", {
			futuresInrAvailable,
			futuresUsdtAvailable,
			accountInrAvailable,
			accountUsdtAvailable,
			selectedInrAvailable: inrAvailable,
			selectedUsdtAvailable: usdtAvailable,
		});

		return {
			inrAvailable,
			usdtAvailable,
			futuresWalletCount: futuresWallets.length,
			accountBalanceCount: accountBalances.length,
		};
	}

	private extractResponseArray(response: any): any[] {
		if (Array.isArray(response)) return response;
		if (Array.isArray(response?.wallets)) return response.wallets;
		if (Array.isArray(response?.balances)) return response.balances;
		if (Array.isArray(response?.data)) return response.data;
		if (Array.isArray(response?.data?.wallets)) return response.data.wallets;
		if (Array.isArray(response?.data?.balances)) return response.data.balances;
		return [];
	}

	private getCurrency(item: any): string {
		return String(
			item?.currency_short_name ??
				item?.currency ??
				item?.coin ??
				item?.margin_currency_short_name ??
				item?.settle_currency_short_name ??
				""
		)
			.trim()
			.toUpperCase();
	}

	private getAvailableBalance(item: any): number {
		const explicitAvailable = Number(
			item?.available_balance ?? item?.availableBalance
		);

		if (Number.isFinite(explicitAvailable)) {
			return Math.max(0, explicitAvailable);
		}

		const balance = Number(
			item?.balance ?? item?.wallet_balance ?? item?.walletBalance ?? 0
		);

		const lockedBalance = Number(
			item?.locked_balance ?? item?.lockedBalance ?? 0
		);

		const crossOrderMargin = Number(
			item?.cross_order_margin ?? item?.crossOrderMargin ?? 0
		);

		const crossUserMargin = Number(
			item?.cross_user_margin ?? item?.crossUserMargin ?? 0
		);

		const isolatedMargin = Number(
			item?.isolated_margin ?? item?.isolatedMargin ?? 0
		);

		const normalizedBalance = Number.isFinite(balance) ? balance : 0;

		const totalReserved =
			(Number.isFinite(lockedBalance) ? lockedBalance : 0) +
			(Number.isFinite(crossOrderMargin) ? crossOrderMargin : 0) +
			(Number.isFinite(crossUserMargin) ? crossUserMargin : 0) +
			(Number.isFinite(isolatedMargin) ? isolatedMargin : 0);

		return Math.max(0, normalizedBalance - totalReserved);
	}

	private sumAvailableBalance(items: any[], currency: "INR" | "USDT"): number {
		return items
			.filter((item) => this.getCurrency(item) === currency)
			.reduce((total, item) => total + this.getAvailableBalance(item), 0);
	}

	private async resolveFuturesPricing(input: {
		pair: string;
		order: any;
		orderType: string;
		marginCurrency: "INR" | "USDT";
	}) {
		const explicitEntryPrice = Number(
			input.order.entryPrice ??
				input.order.entry_price ??
				input.order.currentPrice ??
				input.order.current_price ??
				input.order.markPrice ??
				input.order.mark_price ??
				input.order.price
		);

		let entryPrice = Number.isFinite(explicitEntryPrice)
			? explicitEntryPrice
			: 0;

		if (entryPrice <= 0) {
			entryPrice = await this.getLatestFuturesPrice(input.pair);
		}

		if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
			this.throwError(400, "valid_entry_price_required");
		}

		let usdtInrRate = 1;

		if (input.marginCurrency === "INR") {
			const explicitUsdtInrRate = Number(
				input.order.usdtInrRate ??
					input.order.usdt_inr_rate ??
					input.order.conversionRate ??
					input.order.conversion_rate
			);

			usdtInrRate = Number.isFinite(explicitUsdtInrRate)
				? explicitUsdtInrRate
				: await this.getUSDTINRRate();

			if (!Number.isFinite(usdtInrRate) || usdtInrRate <= 0) {
				this.throwError(400, "valid_usdt_inr_rate_required_for_inr_margin");
			}
		}

		return {
			entryPrice,
			usdtInrRate,
		};
	}

	private calculateFuturesQuantity(input: {
		marginAmount: number;
		leverage: number;
		entryPrice: number;
		marginCurrency: "INR" | "USDT";
		usdtInrRate: number;
	}) {
		const positionSizeInMarginCurrency = input.marginAmount * input.leverage;

		const positionSizeInUSDT =
			input.marginCurrency === "INR"
				? positionSizeInMarginCurrency / input.usdtInrRate
				: positionSizeInMarginCurrency;

		const rawQuantity = positionSizeInUSDT / input.entryPrice;

		const quantity = this.roundFuturesQuantity(rawQuantity);

		return {
			positionSizeInMarginCurrency,
			positionSizeInUSDT,
			rawQuantity,
			quantity,
		};
	}

	private calculateFuturesTPSL(input: {
		side: string;
		entryPrice: number;
		stopLossPrice?: any;
		takeProfitPrice?: any;
		stopLossPercent?: any;
		takeProfitPercent?: any;
	}) {
		let stopLossPrice = Number(input.stopLossPrice);
		let takeProfitPrice = Number(input.takeProfitPrice);

		const stopLossPercent = Number(input.stopLossPercent);
		const takeProfitPercent = Number(input.takeProfitPercent);

		const isBuy = input.side === "buy";
		const entry = input.entryPrice;

		if (
			(!Number.isFinite(stopLossPrice) || stopLossPrice <= 0) &&
			Number.isFinite(stopLossPercent) &&
			stopLossPercent > 0
		) {
			stopLossPrice = isBuy
				? entry * (1 - stopLossPercent / 100)
				: entry * (1 + stopLossPercent / 100);
		}

		if (
			(!Number.isFinite(takeProfitPrice) || takeProfitPrice <= 0) &&
			Number.isFinite(takeProfitPercent) &&
			takeProfitPercent > 0
		) {
			takeProfitPrice = isBuy
				? entry * (1 + takeProfitPercent / 100)
				: entry * (1 - takeProfitPercent / 100);
		}

		if (Number.isFinite(stopLossPrice) && stopLossPrice > 0) {
			if (isBuy && stopLossPrice >= entry) {
				this.throwError(400, "buy_stop_loss_must_be_below_entry_price");
			}

			if (!isBuy && stopLossPrice <= entry) {
				this.throwError(400, "sell_stop_loss_must_be_above_entry_price");
			}
		} else {
			stopLossPrice = 0;
		}

		if (Number.isFinite(takeProfitPrice) && takeProfitPrice > 0) {
			if (isBuy && takeProfitPrice <= entry) {
				this.throwError(400, "buy_take_profit_must_be_above_entry_price");
			}

			if (!isBuy && takeProfitPrice >= entry) {
				this.throwError(400, "sell_take_profit_must_be_below_entry_price");
			}
		} else {
			takeProfitPrice = 0;
		}

		return {
			stopLossPrice: stopLossPrice > 0 ? this.roundPrice(stopLossPrice) : null,
			takeProfitPrice:
				takeProfitPrice > 0 ? this.roundPrice(takeProfitPrice) : null,
		};
	}

	private roundFuturesQuantity(value: number): number {
		const step = Number(process.env.COINDCX_FUTURES_QTY_STEP || 0.001);

		if (!Number.isFinite(value) || value <= 0) {
			return 0;
		}

		if (!Number.isFinite(step) || step <= 0) {
			this.throwError(500, "invalid_quantity_step_config");
		}

		// CoinDCX BTC futures requires quantity like 0.001, 0.002, 0.003...
		// Floor is safer because it never exceeds the user's selected marginAmount.
		const stepped = Math.floor(value / step) * step;
		const decimals = this.getDecimalsFromStep(step);

		return Number(stepped.toFixed(decimals));
	}

	private getDecimalsFromStep(step: number): number {
		const text = String(step);

		if (!text.includes(".")) {
			return 0;
		}

		return text.split(".")[1].length;
	}

	private calculateRequiredMarginForMinQuantity(input: {
		minQuantity: number;
		entryPrice: number;
		leverage: number;
		marginCurrency: "INR" | "USDT";
		usdtInrRate: number;
	}): number {
		const positionSizeUSDT = input.minQuantity * input.entryPrice;
		const marginUSDT = positionSizeUSDT / input.leverage;

		const margin =
			input.marginCurrency === "INR"
				? marginUSDT * input.usdtInrRate
				: marginUSDT;

		return this.roundPrice(margin);
	}

	private roundPrice(value: number): number {
		const decimals = Number(process.env.COINDCX_FUTURES_PRICE_DECIMALS || 2);

		if (!Number.isFinite(value) || value <= 0) {
			return 0;
		}

		const factor = Math.pow(10, decimals);
		return Math.round(value * factor) / factor;
	}

	private async getLatestFuturesPrice(pair: string): Promise<number> {
		const normalizedPair = this.normalizeFuturesPair(pair);

		const activeInstruments = await this.publicGet(
			"/exchange/v1/derivatives/futures/data/active_instruments",
			{
				margin_currency_short_name: "USDT",
			}
		);

		const items = this.extractResponseArray(activeInstruments);

		const match = items.find((item: any) => {
			const itemPair = String(
				item?.pair ??
					item?.symbol ??
					item?.market ??
					item?.instrument_name ??
					""
			)
				.trim()
				.toUpperCase();

			return itemPair === normalizedPair.toUpperCase();
		});

		const price = Number(
			match?.last_price ??
				match?.lastPrice ??
				match?.mark_price ??
				match?.markPrice ??
				match?.index_price ??
				match?.indexPrice ??
				match?.price
		);

		if (Number.isFinite(price) && price > 0) {
			return price;
		}

		this.throwError(400, "latest_futures_price_not_available");
	}

	private async getUSDTINRRate(): Promise<number> {
		const ticker = await this.publicGet("/exchange/ticker");

		const items = Array.isArray(ticker) ? ticker : [];

		const match = items.find((item: any) => {
			const market = String(item?.market ?? item?.symbol ?? item?.pair ?? "")
				.trim()
				.toUpperCase();

			return market === "USDTINR" || market === "USDT_INR";
		});

		const rate = Number(
			match?.last_price ??
				match?.lastPrice ??
				match?.last ??
				match?.close ??
				match?.price
		);

		if (Number.isFinite(rate) && rate > 0) {
			return rate;
		}

		this.throwError(400, "usdt_inr_rate_not_available");
	}

	private isInsufficientFundsError(error: any): boolean {
		const message = String(this.getErrorMessage(error) ?? "")
			.trim()
			.toLowerCase()
			.replace(/[_-]/g, " ");

		return (
			message.includes("insufficient fund") ||
			message.includes("insufficient balance") ||
			message.includes("not enough balance") ||
			message.includes("not enough fund")
		);
	}

	private normalizeOrder(order: CoinDCXOrderPayload): CoinDCXOrderPayload {
		if (!order) {
			this.throwError(400, "order_required");
		}

		const symbol = String(order.symbol ?? "").trim();
		const side = String(order.side ?? "").trim().toUpperCase();
		const quantity = Number(order.quantity);

		if (!symbol) {
			this.throwError(400, "symbol_required");
		}

		if (!["BUY", "SELL"].includes(side)) {
			this.throwError(400, "invalid_order_side");
		}

		if (!Number.isFinite(quantity) || quantity <= 0) {
			this.throwError(400, "invalid_quantity");
		}

		if (order.price !== undefined && order.price !== null) {
			const price = Number(order.price);

			if (!Number.isFinite(price) || price <= 0) {
				this.throwError(400, "invalid_price");
			}
		}

		return {
			...order,
			symbol,
			side: side as "BUY" | "SELL",
			quantity,
			price:
				order.price !== undefined && order.price !== null
					? Number(order.price)
					: undefined,
			orderType: order.orderType || "market_order",
		};
	}

	private normalizeOrderType(orderType?: string) {
		const value = String(orderType || "market_order")
			.trim()
			.toLowerCase();

		if (
			value === "market" ||
			value === "market_order" ||
			value === "marketorder"
		) {
			return "market_order";
		}

		if (value === "limit" || value === "limit_order" || value === "limitorder") {
			return "limit_order";
		}

		return value;
	}

	private normalizeFuturesPair(symbol: string) {
		const raw = String(symbol || "").trim().toUpperCase();

		if (!raw) return "";

		if (raw.startsWith("B-") || raw.startsWith("BM-")) {
			return raw;
		}

		if (raw.includes("_")) {
			return `B-${raw.replace(/^B-/, "")}`;
		}

		const cleaned = raw.replace("/", "").replace("-", "").replace("_", "");

		if (cleaned.endsWith("USDT")) {
			const base = cleaned.slice(0, -4);
			return `B-${base}_USDT`;
		}

		return raw;
	}

	private normalizeFuturesSide(side: string) {
		const value = String(side || "").trim().toLowerCase();

		if (value === "buy" || value === "long") return "buy";
		if (value === "sell" || value === "short") return "sell";

		this.throwError(400, "invalid_futures_side");
	}

	private normalizeFuturesOrderType(orderType?: string) {
		const value = String(orderType || "market_order")
			.trim()
			.toLowerCase()
			.replace(/-/g, "_");

		if (["market", "market_order", "marketorder"].includes(value)) {
			return "market_order";
		}

		if (["limit", "limit_order", "limitorder"].includes(value)) {
			return "limit_order";
		}

		if (["stop_limit", "sl", "sl_limit"].includes(value)) {
			return "stop_limit";
		}

		return value;
	}

	private normalizeTakeProfit(input: number | CoinDCXFuturesTPSLOrder) {
		if (typeof input === "number") {
			return {
				stop_price: String(input),
				order_type: "take_profit_market",
			};
		}

		const stopPrice = Number(input.stopPrice);

		if (!Number.isFinite(stopPrice) || stopPrice <= 0) {
			this.throwError(400, "valid_take_profit_stopPrice_required");
		}

		const orderType = input.orderType || "take_profit_market";

		const data: Record<string, any> = {
			stop_price: String(stopPrice),
			order_type: orderType,
		};

		if (input.limitPrice !== undefined && input.limitPrice !== null) {
			data.limit_price = String(input.limitPrice);
		}

		return data;
	}

	private normalizeStopLoss(input: number | CoinDCXFuturesTPSLOrder) {
		if (typeof input === "number") {
			return {
				stop_price: String(input),
				order_type: "stop_market",
			};
		}

		const stopPrice = Number(input.stopPrice);

		if (!Number.isFinite(stopPrice) || stopPrice <= 0) {
			this.throwError(400, "valid_stop_loss_stopPrice_required");
		}

		const orderType = input.orderType || "stop_market";

		const data: Record<string, any> = {
			stop_price: String(stopPrice),
			order_type: orderType,
		};

		if (input.limitPrice !== undefined && input.limitPrice !== null) {
			data.limit_price = String(input.limitPrice);
		}

		return data;
	}

	private normalizeMarket(symbol: string) {
		const value = String(symbol || "")
			.trim()
			.toUpperCase()
			.replace("/", "")
			.replace("-", "")
			.replace("_", "");

		if (!value) {
			this.throwError(400, "market_required");
		}

		return value;
	}

	private normalizeBatchSize(batchSize?: number) {
		const value = Number(batchSize);

		if (!Number.isFinite(value) || value <= 0) {
			return this.defaultBatchSize;
		}

		return Math.min(Math.floor(value), this.maxBatchSize);
	}

	private buildOrderFromTradeSignal(job: any): CoinDCXOrderPayload {
		const payload =
			job?.payload ??
			job?.signalPayload ??
			job?.order ??
			job?.metadata ??
			job?.meta ??
			{};

		const symbol =
			job?.symbol ??
			payload?.symbol ??
			payload?.market ??
			payload?.pair ??
			payload?.ticker;

		const rawSide =
			job?.side ??
			payload?.side ??
			payload?.action ??
			payload?.signal ??
			payload?.transactionType;

		const quantity =
			job?.quantity ??
			payload?.quantity ??
			payload?.qty ??
			payload?.total_quantity ??
			payload?.totalQuantity;

		const price =
			job?.price ??
			payload?.price ??
			payload?.price_per_unit ??
			payload?.pricePerUnit;

		const orderType =
			job?.orderType ??
			payload?.orderType ??
			payload?.order_type ??
			payload?.type ??
			"market_order";

		const side = this.normalizeSignalSide(rawSide);

		return this.normalizeOrder({
			symbol,
			side,
			quantity: Number(quantity),
			price:
				price !== undefined && price !== null && price !== ""
					? Number(price)
					: undefined,
			orderType,
			clientOrderId: job?.id ? `trade_signal_${job.id}` : undefined,
		});
	}

	private normalizeSignalSide(side: any): "BUY" | "SELL" {
		const value = String(side || "")
			.trim()
			.toUpperCase();

		if (["BUY", "LONG", "ENTRY", "B"].includes(value)) {
			return "BUY";
		}

		if (["SELL", "SHORT", "EXIT", "S"].includes(value)) {
			return "SELL";
		}

		this.throwError(400, "invalid_signal_side");
	}

	private extractBrokerOrderId(response: any): string | null {
		return (
			response?.id ??
			response?.order_id ??
			response?.client_order_id ??
			response?.orders?.[0]?.id ??
			response?.data?.id ??
			response?.data?.order_id ??
			null
		);
	}

	private filterNonZeroBalances(data: any) {
		if (!Array.isArray(data)) {
			return data;
		}

		return data.filter((item: any) => {
			const balance = Number(
				item?.balance ??
					item?.available_balance ??
					item?.locked_balance ??
					item?.quantity ??
					0
			);

			const available = Number(item?.available_balance ?? 0);
			const locked = Number(item?.locked_balance ?? 0);

			return balance > 0 || available > 0 || locked > 0;
		});
	}

	private normalizeBalances(data: any) {
		if (!Array.isArray(data)) {
			return [];
		}

		return data.map((item: any) => {
			const balance = Number(
				item?.balance ??
					item?.available_balance ??
					item?.availableBalance ??
					0
			);

			const lockedBalance = Number(
				item?.locked_balance ??
					item?.lockedBalance ??
					0
			);

			return {
				currency: String(item?.currency ?? item?.coin ?? "").toUpperCase(),
				balance: Number.isFinite(balance) ? balance : 0,
				lockedBalance: Number.isFinite(lockedBalance) ? lockedBalance : 0,
				totalBalance:
					(Number.isFinite(balance) ? balance : 0) +
					(Number.isFinite(lockedBalance) ? lockedBalance : 0),
				raw: item,
			};
		});
	}

	private cleanBaseUrl(baseUrl: string) {
		return String(baseUrl || this.defaultBaseUrl).replace(/\/+$/, "");
	}

	private getBrokerName(account: any) {
		return account?.broker?.code || account?.broker?.name || null;
	}

	private getErrorMessage(error: any) {
		if (!error) return "unknown_error";

		return (
			error?.message ||
			error?.response?.data?.message ||
			error?.response?.data?.error ||
			(typeof error?.response?.data === "string"
				? error.response.data
				: undefined) ||
			"unknown_error"
		);
	}

	private throwError(statusCode: number, message: string): never {
		throw {
			statusCode,
			message,
		};
	}
}