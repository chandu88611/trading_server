export type CoinDCXAuthPayload = {
	userId: number;
	tradingAccountId: number;
	apiKey: string;
	apiSecret: string;
	baseUrl?: string;
};

export type CoinDCXTokenStatus = {
	tradingAccountId: number;
	broker: string | null;
	hasApiKey: boolean;
	hasApiSecret: boolean;
	baseUrl?: string | null;
	connectedAt?: string | null;
	verifiedAt?: string | null;
	isReady: boolean;
};

export type CoinDCXVerifyTokenResult = {
	valid: boolean;
	tradingAccountId: number;
	broker: string | null;
	checkedAt: string;
	error?: string;
};

export type CoinDCXDeleteTokenResult = {
	deleted: boolean;
	tradingAccountId: number;
	broker: string | null;
};

export type CoinDCXOrderPayload = {
	symbol: string;
	side: "BUY" | "SELL";
	quantity: number;
	orderType?: string;
	price?: number;
	clientOrderId?: string;
};

export type CoinDCXPlaceOrderRequest = {
	userId: number;
	tradingAccountId: number;
	order: CoinDCXOrderPayload;
};

export type CoinDCXModifyOrderRequest = {
	userId: number;
	tradingAccountId: number;
	orderId: string;
	quantity?: number;
	price?: number;
};

export type CoinDCXCancelOrderRequest = {
	userId: number;
	tradingAccountId: number;
	orderId: string;
};

export type CoinDCXBatchRequest = {
	batchSize?: number;
};

export type CoinDCXPublicTickerRequest = {
	market?: string;
};

export type CoinDCXPublicOrderbookRequest = {
	market: string;
};

export type CoinDCXFuturesOrderPayload = {
	symbol: string;
	side: "BUY" | "SELL";
	quantity: number;
	leverage: number;
	orderType?: string;
	price?: number;
	notification?: "no_notification" | "email_notification" | "push_notification";
	timeInForce?: "good_till_cancel" | "immediate_or_cancel" | "fill_or_kill";
	hidden?: boolean;
	postOnly?: boolean;

	/**
	 * Optional. CoinDCX position TP/SL requires active position id.
	 * Usually flow is:
	 * 1. place futures order
	 * 2. fetch positions
	 * 3. create TP/SL using positionId
	 */
	positionId?: string;
	stopLoss?: number | CoinDCXFuturesTPSLOrder;
	takeProfit?: number | CoinDCXFuturesTPSLOrder;
};

export type CoinDCXFuturesTPSLOrder = {
	stopPrice: number;
	limitPrice?: number;
	orderType?: "stop_market" | "stop_limit" | "take_profit_market" | "take_profit_limit";
};

export type CoinDCXFuturesPlaceOrderRequest = {
	userId: number;
	tradingAccountId: number;
	order: CoinDCXFuturesOrderPayload;
};

export type CoinDCXFuturesPositionsRequest = {
	userId: number;
	tradingAccountId: number;
	page?: number;
	size?: number;
};

export type CoinDCXFuturesCreateTPSLRequest = {
	userId: number;
	tradingAccountId: number;
	positionId: string;
	stopLoss?: number | CoinDCXFuturesTPSLOrder;
	takeProfit?: number | CoinDCXFuturesTPSLOrder;
};

export type CoinDCXFuturesPositionActionRequest = {
	userId: number;
	tradingAccountId: number;
	positionId: string;
};

export type CoinDCXFuturesInstrumentRequest = {
	pair?: string;
};
