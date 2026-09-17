import { CoinDCXMarketService, prepareOrder, quantizePrice, spotExitQuantity } from "./coindcxMarket.service";
import { decrypt } from "../../../utils/crypto";
import AppDataSource from "../../../db/data-source";
import { TradeGuardService, isExitSignal } from "../../trade/services/tradeGuard.service";
import axios, { AxiosRequestConfig } from "axios";
import crypto from "crypto";
import { CoinDCXDB } from "./coindcx.db";
import { TradingAccountStatus } from "../../subscriptionPlan/enums/subscriberPlan.enum";
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

type PreparedOrder = { quantity: number; price: number; stopLoss?: number | null; takeProfit?: number | null };
type OnPrepared = (order: PreparedOrder) => Promise<void>;

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

	private readonly markets = new CoinDCXMarketService((path, query) => this.publicGet(path, query), this.defaultBaseUrl);

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
		}, { status: TradingAccountStatus.PENDING, checkedAt: null });

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
			}, { status: TradingAccountStatus.VERIFIED, checkedAt: new Date(checkedAt) });

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
	async placeOrder(request: CoinDCXPlaceOrderRequest, onPrepared?: OnPrepared) {
		const account = await this.db.getTradingAccountById(
			request.userId,
			request.tradingAccountId
		);

		if (!account) {
			this.throwError(404, "trading_account_not_found");
		}

		const credentials = this.requireCredentials(account!);
		const order = this.normalizeOrder(request.order);
        const rules = await this.markets.spot(this.normalizeMarket(order.symbol));
        const marketOrder = this.normalizeOrderType(order.orderType) === "market_order";
        const ticker: any = marketOrder ? await this.getPublicTicker({ market: order.symbol }) : null;
        const quote = Array.isArray(ticker) ? ticker[0] : ticker;
        const estimatedPrice = marketOrder ? Number(quote?.last_price) : Number(order.price);
        if (!Number.isFinite(estimatedPrice) || estimatedPrice <= 0) this.throwError(400, "coindcx_price_unavailable");
        if (order.side === "SELL") {
            const balances = this.extractResponseArray(await this.privatePost(credentials, "/exchange/v1/users/balances", { timestamp: Date.now() }));
            const asset = balances.find(row => String(row.currency).toUpperCase() === rules.baseAsset.toUpperCase());
            // CoinDCX 'balance' is available; locked_balance is reported separately.
            order.quantity = spotExitQuantity(order.quantity, Number(asset?.balance ?? 0), rules.quantityStep, rules.minQuantity);
        }
        const prepared = prepareOrder(order.quantity, estimatedPrice, rules, marketOrder);
        order.quantity = prepared.quantity;
        if (!marketOrder) order.price = prepared.price;
        if (order.stopLoss) order.stopLoss = quantizePrice(order.stopLoss, rules.tickSize);
        if (order.takeProfit) order.takeProfit = quantizePrice(order.takeProfit, rules.tickSize);
        await onPrepared?.({ ...prepared, stopLoss: order.stopLoss, takeProfit: order.takeProfit });


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
	async placeFuturesOrder(request: CoinDCXFuturesPlaceOrderRequest, onPrepared?: OnPrepared) {
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

		const leverage = Number(order.leverage ?? account.accountMeta?.coindcx?.leverage ?? 2);

		if (!Number.isFinite(leverage) || leverage < 1) {
			this.throwError(400, "valid_leverage_required");
		}

		const configuredMargin = Number(
			order.marginAmount ??
				order.margin_amount ??
				order.margin ??
				order.capital
		);

		const quantityOrder = order.marginAmount == null && order.margin_amount == null && order.margin == null && order.capital == null;
		const requestedQuantity = Number(order.quantity);
		if (quantityOrder && (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0)) {
			this.throwError(400, "invalid_quantity");
		}
		if (!quantityOrder && (!Number.isFinite(configuredMargin) || configuredMargin <= 0)) {
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
		} else if (requestedMarginCurrency === "INR") {
			addCurrencyAttempt("INR");
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
			let marginAmount = configuredMargin;

			const availableBalance =
				marginCurrency === "INR"
					? balances.inrAvailable
					: balances.usdtAvailable;

			const positionMarginType =
				marginCurrency === "INR" ? "isolated" : requestedPositionMarginType;

			if (!quantityOrder && marginAmount > availableBalance) {
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

			if (quantityOrder) {
				marginAmount = requestedQuantity * pricing.entryPrice / leverage * (marginCurrency === "INR" ? pricing.usdtInrRate : 1);
				if (!Number.isFinite(marginAmount) || marginAmount <= 0) this.throwError(400, "valid_margin_amount_required");
				if (marginAmount > availableBalance) continue;
			}
			const quantityInfo = this.calculateFuturesQuantity({
				marginAmount,
				leverage,
				entryPrice: pricing.entryPrice,
				marginCurrency,
				usdtInrRate: pricing.usdtInrRate,
			});
			if (quantityOrder) {
				// Preserve the signal's executed quantity instead of interpreting it as margin.
				quantityInfo.quantity = requestedQuantity;
				quantityInfo.rawQuantity = requestedQuantity;
			}

            const rules = await this.markets.futures(pair, marginCurrency);
            const prepared = prepareOrder(quantityInfo.rawQuantity, pricing.entryPrice, rules, orderType === "market_order");
            quantityInfo.quantity = prepared.quantity;
            if (orderType !== "market_order") pricing.entryPrice = prepared.price;
            const protectionPrice = (value: any) => value == null ? undefined : quantizePrice(Number(value), rules.tickSize);

			const tpsl = this.calculateFuturesTPSL({
				side,
				entryPrice: pricing.entryPrice,
                stopLossPrice: protectionPrice(order.stopLossPrice ?? order.stop_loss_price ?? order.stopLoss),
                takeProfitPrice: protectionPrice(order.takeProfitPrice ?? order.take_profit_price ?? order.takeProfit),
				stopLossPercent:
					order.stopLossPercent ??
					order.stop_loss_percent ??
					order.slPercent,
				takeProfitPercent:
					order.takeProfitPercent ??
					order.take_profit_percent ??
					order.tpPercent,
			});

            if (tpsl.stopLossPrice) tpsl.stopLossPrice = quantizePrice(tpsl.stopLossPrice, rules.tickSize);
            if (tpsl.takeProfitPrice) tpsl.takeProfitPrice = quantizePrice(tpsl.takeProfitPrice, rules.tickSize);
            // Recheck directional validity after rounding percentage-based protection.
            this.calculateFuturesTPSL({ side, entryPrice: pricing.entryPrice, stopLossPrice: tpsl.stopLossPrice, takeProfitPrice: tpsl.takeProfitPrice });
            await onPrepared?.({ ...prepared, stopLoss: tpsl.stopLossPrice, takeProfit: tpsl.takeProfitPrice });
            // Current CoinDCX contract calls this update_leverage (not change_leverage).
            const leverageResult = await this.privatePost(credentials, "/exchange/v1/derivatives/futures/positions/update_leverage", {
                timestamp: Date.now(), pair, leverage: String(leverage), margin_currency_short_name: marginCurrency,
            });
            if (leverageResult?.success === false || Number(leverageResult?.code ?? leverageResult?.status ?? 200) >= 400) this.throwError(400, "coindcx_leverage_update_failed");
            console.info("[COINDCX] leverage applied", { pair, marginCurrency, leverage });

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

            // Protection is attached through create_tpsl after confirmed fills.

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

  async getAllFuturesPositions(request: CoinDCXFuturesPositionsRequest): Promise<any[]> {
    const positions: any[] = [];
    for (let page = 1; page <= 100; page++) {
      const rows = this.extractResponseArray(await this.getFuturesPositions({ ...request, page, size:100 }));
      positions.push(...rows);
      if (rows.length < 100) return positions;
    }
    throw new Error("coindcx_positions_pagination_incomplete");
  }

  async getStreamCredentials(userId: number, tradingAccountId: number) {
    const account = await this.db.getTradingAccountById(userId,tradingAccountId);
    if (!account) throw new Error("trading_account_not_found");
    return this.requireCredentials(account);
  }

  async protectFilledFutures(account: any, signal: any) {
    if (signal.execution_state !== "FILLED" || account.accountMeta?.emergencyHalt) return;
    if (!signal.stop_loss && !signal.take_profit) return;
    if (signal.protection_state === "ACTIVE") return;
    const positions = await this.getAllFuturesPositions({ userId:Number(account.userId), tradingAccountId:Number(account.id) });
    const matches = positions.filter(p => p.pair === this.normalizeFuturesPair(signal.symbol) && Number(p.active_pos) !== 0 && (Number(p.active_pos)>0) === (String(signal.action).toUpperCase()==="BUY"));
    if (matches.length !== 1) throw new Error("futures_position_not_uniquely_identified");
    const position = matches[0];
    const [conflict] = await AppDataSource.query(`SELECT id FROM trade_signals WHERE trading_account_id=$1 AND broker_position_id=$2 AND id<>$3 AND protection_state='ACTIVE' AND (stop_loss IS DISTINCT FROM $4::numeric OR take_profit IS DISTINCT FROM $5::numeric) LIMIT 1`, [account.id,String(position.id),signal.id,signal.stop_loss,signal.take_profit]);
    if (conflict) throw new Error("position_protection_conflicts_with_existing_signal");
    const matchesTriggers = (!signal.stop_loss || Number(position.stop_loss_trigger)===Number(signal.stop_loss)) && (!signal.take_profit || Number(position.take_profit_trigger)===Number(signal.take_profit));
    if (!matchesTriggers) {
      await AppDataSource.query(`UPDATE trade_signals SET protection_state='PENDING',broker_position_id=$2 WHERE id=$1`, [signal.id,String(position.id)]);
      const response: any = await this.createFuturesTPSL({ userId:Number(account.userId),tradingAccountId:Number(account.id),positionId:String(position.id),stopLoss:signal.stop_loss == null ? undefined : Number(signal.stop_loss),takeProfit:signal.take_profit == null ? undefined : Number(signal.take_profit) });
      const bracketOrderIds: string[] = [];
      for (const leg of [signal.stop_loss ? "stop_loss" : null,signal.take_profit ? "take_profit" : null].filter(Boolean) as string[]) {
        if (!response?.[leg]?.id || response[leg].success === false) throw new Error("futures_protection_not_confirmed");
        bracketOrderIds.push(String(response[leg].id));
      }
      await AppDataSource.query(`UPDATE trade_signals SET protection_detail=COALESCE(protection_detail,'{}'::jsonb)||jsonb_build_object('bracketOrderIds',$2::jsonb) WHERE id=$1`, [signal.id,JSON.stringify(bracketOrderIds)]);
    }
    await AppDataSource.query(`UPDATE trade_signals SET protection_state='ACTIVE',broker_position_id=$2,protection_detail=COALESCE(protection_detail,'{}'::jsonb)||jsonb_build_object('confirmedAt',now()) WHERE id=$1`, [signal.id,String(position.id)]);
  }

  async queueCloseAlert(input: { userId?: number; planId?: number; subscriptionId?: number; symbol: string; entryRef?: string }) {
    if ((!input.userId && !input.planId) || !input.symbol) this.throwError(400, "coindcx_close_scope_required");
    const symbol = /^BM?-/.test(input.symbol.toUpperCase()) ? this.normalizeFuturesPair(input.symbol) : this.normalizeMarket(input.symbol);
    const rows = await AppDataSource.query(`WITH queued AS (
      UPDATE trade_signals_status s SET status='pending_close',last_error=NULL,next_retry_at=NULL,updated_at=now()
      FROM trade_signals t JOIN user_trading_accounts a ON a.id=t.trading_account_id JOIN brokers b ON b.id=a.broker_id
      WHERE s.signal_id=t.id AND b.code='COINDCX' AND UPPER(t.symbol)=UPPER($1)
        AND ($2::bigint IS NULL OR a.user_id=$2) AND ($3::bigint IS NULL OR a.subscription_id=$3)
        AND ($4::bigint IS NULL OR EXISTS (SELECT 1 FROM user_subscriptions sub WHERE sub.id=a.subscription_id AND sub.plan_id=$4))
        AND ($5::text IS NULL OR t.entry_ref=$5) AND t.execution_state='FILLED' AND s.status='completed'
      RETURNING t.id
    ) UPDATE trade_signals t SET protection_detail=COALESCE(protection_detail,'{}'::jsonb)||jsonb_build_object('closeSource','TRADINGVIEW','closeRequestedAt',now())
      FROM queued WHERE t.id=queued.id RETURNING t.id`, [symbol,input.userId ?? null,input.subscriptionId ?? null,input.planId ?? null,input.entryRef ?? null]);
    // An already queued/closed alert is idempotent; never create an opposite entry.
    const queued = Array.isArray(rows[0]) ? rows[0] : rows;
    return { snapshotId: null, signalCount: queued.length, recipientCount: queued.length ? 1 : 0 };
  }

  /** Observe explicit flat positions; a missing page/position is never proof of closure. */
  async cleanupClosedProtection(account: any) {
    const signals = await AppDataSource.query(`SELECT t.id,t.broker_position_id FROM trade_signals t WHERE t.trading_account_id=$1 AND t.broker_position_id IS NOT NULL AND COALESCE(t.protection_state,'')<>'CLEANED'`, [account.id]);
    if (!signals.length) return;
    const positions = await this.getAllFuturesPositions({ userId:Number(account.userId), tradingAccountId:Number(account.id) });
    for (const positionId of new Set<string>(signals.map((s: any) => String(s.broker_position_id)))) {
      const position = positions.find(p => String(p.id) === positionId);
      if (!position || position.active_pos == null || Number(position.active_pos) !== 0) continue;
      await this.cancelFuturesOpenOrdersForPosition({ userId:Number(account.userId),tradingAccountId:Number(account.id),positionId });
      await AppDataSource.transaction(async manager => {
        await manager.query(`UPDATE trade_signals SET protection_state='CLEANED',protection_detail=COALESCE(protection_detail,'{}'::jsonb)||jsonb_build_object('positionFlatAt',now()),updated_at=now() WHERE trading_account_id=$1 AND broker_position_id=$2`, [account.id,positionId]);
        await manager.query(`UPDATE trade_signals_status s SET status='closed',updated_at=now() FROM trade_signals t WHERE s.signal_id=t.id AND t.trading_account_id=$1 AND t.broker_position_id=$2 AND s.status IN ('completed','pending_close','in_progress_close')`, [account.id,positionId]);
      });
    }
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

        const positions = await this.getAllFuturesPositions({ userId:request.userId,tradingAccountId:request.tradingAccountId });
        const position = positions.find(p => String(p.id) === String(request.positionId));
        if (!position?.pair || !Number(position.active_pos)) this.throwError(400, "futures_active_position_required");
        const rules = await this.markets.futures(position.pair, position.margin_currency_short_name ?? "USDT");
		if (request.takeProfit) {
			body.take_profit = this.normalizeTakeProfit(request.takeProfit);
		}

		if (request.stopLoss) {
			body.stop_loss = this.normalizeStopLoss(request.stopLoss);
		}

        for (const leg of [body.take_profit, body.stop_loss].filter(Boolean)) {
            leg.stop_price = quantizePrice(leg.stop_price, rules.tickSize);
            if (leg.limit_price != null) leg.limit_price = quantizePrice(leg.limit_price, rules.tickSize);
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

        await this.cancelFuturesOpenOrdersForPosition(request);

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

		const result = await this.privatePost(
			credentials,
			"/exchange/v1/derivatives/futures/positions/cancel_all_open_orders_for_position",
			{
				timestamp: Date.now(),
				id: request.positionId,
			}
		);
        if (result?.success === false || Number(result?.code ?? result?.status ?? 200) >= 400) this.throwError(400, "coindcx_bracket_cancellation_failed");
        return result;
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
				if (![tradingAccount.broker?.code, tradingAccount.broker?.name]
					.some((value) => String(value ?? "").toUpperCase() === "COINDCX")) {
					this.throwError(400, "trade_signal_broker_not_coindcx");
				}

                if (!(await new TradeGuardService().validateTrade(tradingAccount, job)).allowed) {
                    result.failed += 1;
                    result.items.push({ id: job.id, status: "REJECTED_RISK_LIMIT" });
                    continue;
                }
                const closing = isExitSignal(job);
                const futures = String(job.instrumentType ?? "").toUpperCase() === "FUTURES" || /^BM?-/.test(String(job.symbol ?? "").toUpperCase());
                if (closing && futures && !job.brokerPositionId) {
                    const positions = await this.getAllFuturesPositions({ userId:Number(tradingAccount.userId),tradingAccountId:Number(tradingAccount.id) });
                    const matches = positions.filter(p => p.pair === this.normalizeFuturesPair(job.symbol) && Number(p.active_pos) !== 0 && (Number(p.active_pos)>0) === (String(job.action).toUpperCase()==="BUY"));
                    if (matches.length !== 1) this.throwError(400, "futures_close_position_not_uniquely_identified");
                    job.brokerPositionId = String(matches[0].id);
                    await AppDataSource.query(`UPDATE trade_signals SET broker_position_id=$2 WHERE id=$1`, [job.id,job.brokerPositionId]);
                }
                if (closing && job.brokerPositionId) {
                    const exitResult = await this.exitFuturesPosition({ userId: Number(tradingAccount.userId), tradingAccountId: Number(tradingAccount.id), positionId: String(job.brokerPositionId) });
                    await this.db.markJobSuccess(job, this.extractBrokerOrderId(exitResult));
                    result.completed += 1;
                    result.items.push({ id: job.id, status: "closed" });
                    continue;
                }
                // Shared spot close jobs retain the original entry side and volume.
                if (closing && futures) this.throwError(400, "futures_close_requires_position_id");
                if (closing && (!job.brokerOrderId || String(job.action).toUpperCase() !== "BUY")) {
                    this.throwError(400, "spot_close_requires_confirmed_buy_entry");
                }
                const order = this.buildOrderFromTradeSignal(closing ? { ...job, action: "SELL", orderType: "market_order", limitPrice: null } : job);
                if (closing) order.clientOrderId = `trade_signal_close_${job.id}`;

				const request = {
					userId: Number(tradingAccount.userId),
					tradingAccountId: Number(tradingAccount.id),
					order,
				};
                const onPrepared: OnPrepared = async prepared => {
                    if (closing) {
                        await AppDataSource.query(`UPDATE trade_signals SET protection_detail=COALESCE(protection_detail,'{}'::jsonb)||jsonb_build_object('closeQuantity',$2::numeric,'unsubmittedQuantity',GREATEST(volume-$2::numeric,0)),updated_at=now() WHERE id=$1`, [job.id, prepared.quantity]);
                    } else {
                        await AppDataSource.query(`UPDATE trade_signals SET volume=$2,limit_price=CASE WHEN limit_price IS NULL THEN NULL ELSE $3::numeric END,stop_loss=$4,take_profit=$5,protection_detail=COALESCE(protection_detail,'{}'::jsonb)||jsonb_build_object('requestedQuantity',$6::numeric),updated_at=now() WHERE id=$1`, [job.id,prepared.quantity,prepared.price,prepared.stopLoss ?? null,prepared.takeProfit ?? null,job.volume]);
                    }
                };
				const orderResult: any = futures
					? await this.placeFuturesOrder({ ...request, order: { ...order, leverage: Number(job.strategy?.defaultParams?.coindcx?.leverage ?? job.strategy?.defaultParams?.leverage ?? tradingAccount.accountMeta?.coindcx?.leverage ?? 2), marginCurrency: tradingAccount.accountMeta?.coindcx?.marginCurrency ?? "AUTO", positionMarginType: tradingAccount.accountMeta?.coindcx?.positionMarginType ?? "isolated" } as any }, onPrepared)
					: await this.placeOrder(request, onPrepared);

				const brokerOrderId = this.extractBrokerOrderId(futures ? orderResult.order : orderResult);

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

				console.error("[COINDCX] execution failed", { signalId: job.id, error });
                const rejected = ["coindcx_below_min_notional", "coindcx_below_min_quantity", "coindcx_above_max_quantity"].includes(message);
                if (rejected) await AppDataSource.query(`UPDATE trade_signals_status SET status=$2,last_error=$3,next_retry_at=NULL,updated_at=now() WHERE signal_id=$1`, [job.id,isExitSignal(job) ? "close_blocked" : "rejected",message]);
                else await this.db.markJobFailed(job as any, error instanceof Error ? error : message);

				result.failed += 1;
				result.items.push({
					id: (job as any)?.id,
					status: rejected ? "rejected" : "failed",
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

  async getTradeHistory(userId: number, tradingAccountId: number, signals: any[] = []) {
    const account = await this.db.getTradingAccountById(userId, tradingAccountId);
    if (!account) this.throwError(404, "trading_account_not_found");
    const credentials = this.requireCredentials(account);
    const fills: any[] = [];
    let fromId: string | undefined;
    for (let page = 0; page < 100; page++) {
      const rows = this.extractResponseArray(await this.privatePost(credentials, "/exchange/v1/orders/trade_history", { limit: 500, sort: "asc", ...(fromId ? { from_id: fromId } : {}) }));
      fills.push(...rows);
      if (rows.length < 500) break;
      const next = String(rows[rows.length - 1].id);
      if (next === fromId || page === 99) throw new Error("coindcx_history_pagination_incomplete");
      fromId = next;
    }
    for (const signal of signals.filter(s => s.instrument_type === "FUTURES" || /^BM?-/.test(s.symbol))) {
      for (const orderId of [...new Set([signal.broker_order_id,signal.broker_close_order_id,...(signal.protection_detail?.bracketOrderIds ?? [])].filter(Boolean))]) {
        for (let page = 1; page <= 100; page++) {
          const rows = this.extractResponseArray(await this.privatePost(credentials, "/exchange/v1/derivatives/futures/trades", {
            pair: this.normalizeFuturesPair(signal.symbol), order_id: orderId,
            from_date: new Date(signal.created_at).toISOString().slice(0,10), to_date: new Date().toISOString().slice(0,10), page: String(page), size: "100", margin_currency_short_name: ["USDT","INR"],
          }));
          fills.push(...rows.map(r => ({ ...r, pair: r.pair ?? signal.symbol })));
          if (rows.length < 100) break;
          if (page === 100) throw new Error("coindcx_futures_history_incomplete");
        }
      }
    }
    return fills;
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
			apiKey: decrypt(String(meta.apiKey)),
			apiSecret: decrypt(String(meta.apiSecret)),
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

		const quantity = rawQuantity;

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
			stopLossPrice: stopLossPrice > 0 ? stopLossPrice : null,
			takeProfitPrice:
				takeProfitPrice > 0 ? takeProfitPrice : null,
		};
	}

    private async getLatestFuturesPrice(pair: string): Promise<number> {
        // active_instruments only lists symbols; use the documented real-time price feed.
        const { data } = await axios.get("https://public.coindcx.com/market_data/v3/current_prices/futures/rt", { timeout: this.requestTimeout });
        const quote = data?.prices?.[this.normalizeFuturesPair(pair)];
        const price = Number(quote?.ls);
        const timestamp = Number(data?.ts);
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(timestamp) || Date.now()-timestamp>30000 || timestamp>Date.now()+5000) {
            this.throwError(400, "latest_futures_price_not_available");
        }
        return price;
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
			job?.action ??
			job?.side ??
			payload?.side ??
			payload?.action ??
			payload?.signal ??
			payload?.transactionType;

		const quantity =
			job?.volume ??
			job?.quantity ??
			payload?.volume ??
			payload?.quantity ??
			payload?.qty ??
			payload?.total_quantity ??
			payload?.totalQuantity;

		const price = job && "limitPrice" in job
			? job.limitPrice
			: payload?.limitPrice ?? job?.price ?? payload?.price ??
				payload?.price_per_unit ?? payload?.pricePerUnit;

		const orderType =
			job?.orderType ??
			payload?.orderType ??
			payload?.order_type ??
			payload?.type ??
			"market_order";

		const side = this.normalizeSignalSide(rawSide);
		const stopLoss = job?.stopLoss ?? job?.sl ?? payload?.stopLoss ?? payload?.sl;
		const takeProfit = job?.takeProfit ?? job?.tp ?? payload?.takeProfit ?? payload?.tp;
		const isLimitOrder = this.normalizeOrderType(orderType) === "limit_order";
		if (isLimitOrder && (price === undefined || price === null || price === "")) {
			this.throwError(400, "limit_price_required");
		}

		return this.normalizeOrder({
			symbol,
			side,
			quantity: Number(quantity),
			price:
				isLimitOrder && price !== undefined && price !== null && price !== ""
					? Number(price)
					: undefined,
			orderType,
			clientOrderId: job?.id ? `trade_signal_${job.id}` : undefined,
			stopLoss: stopLoss == null ? undefined : Number(stopLoss),
			takeProfit: takeProfit == null ? undefined : Number(takeProfit),
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
		if (Array.isArray(response)) return this.extractBrokerOrderId(response[0]);
		return (
			response?.id ??
			response?.order_id ??
			response?.orderId ??
			response?.orders?.[0]?.id ??
			response?.data?.id ??
			response?.data?.order_id ??
			response?.data?.[0]?.id ??
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
