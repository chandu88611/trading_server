export type CoinDCXAuthPayload = {
	userId: number;
	tradingAccountId: number;
	apiKey: string;
	apiSecret: string;
	baseUrl?: string;
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
