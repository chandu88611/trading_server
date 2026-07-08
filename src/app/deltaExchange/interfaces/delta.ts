export type DeltaAuthPayload = {
	userId: number;
	tradingAccountId: number;
	apiKey: string;
	apiSecret: string;
	baseUrl?: string;
};

export type DeltaTokenStatus = {
	tradingAccountId: number;
	broker: string | null;
	hasApiKey: boolean;
	hasApiSecret: boolean;
	baseUrl?: string | null;
	connectedAt?: string | null;
	verifiedAt?: string | null;
	lastVerifyStatus?: string | null;
	isReady: boolean;
};

export type DeltaVerifyTokenResult = {
	valid: boolean;
	tradingAccountId: number;
	broker: string | null;
	checkedAt: string;
	error?: string;
};

export type DeltaDeleteTokenResult = {
	deleted: boolean;
	tradingAccountId: number;
	broker: string | null;
};

export type DeltaOrderPayload = {
	symbol: string;
	side: "BUY" | "SELL";
	quantity: number;
	orderType?: string;
	price?: number;
	productId?: number;
	clientOrderId?: string;
	reduceOnly?: boolean;
};

export type DeltaPlaceOrderRequest = {
	userId: number;
	tradingAccountId: number;
	order: DeltaOrderPayload;
};

export type DeltaModifyOrderRequest = {
	userId: number;
	tradingAccountId: number;
	orderId: string;
	quantity?: number;
	price?: number;
};

export type DeltaCancelOrderRequest = {
	userId: number;
	tradingAccountId: number;
	orderId: string;
};

export type DeltaBatchRequest = {
	batchSize?: number;
};

export type DeltaPublicTickerRequest = {
	symbol?: string;
	productId?: number;
};

export type DeltaPublicOrderbookRequest = {
	symbol?: string;
	productId?: number;
};