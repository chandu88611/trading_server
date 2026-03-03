export type DhanAuthPayload = {
	userId: number;
	tradingAccountId: number;
	accessToken: string;
	baseUrl?: string;
	apiKey?: string;
};

export type DhanGenerateTokenRequest = {
	userId: number;
	tradingAccountId: number;
	totp: string;
	baseUrl?: string;
};

export type DhanOrderPayload = {
	symbol: string;
	exchange?: string;
	side: "BUY" | "SELL";
	quantity: number;
	orderType?: string;
	product?: string;
	price?: number;
	triggerPrice?: number;
	validity?: string;
	clientOrderId?: string;
};

export type DhanPlaceOrderRequest = {
	userId: number;
	tradingAccountId: number;
	order: DhanOrderPayload;
};

export type DhanModifyOrderRequest = {
	userId: number;
	tradingAccountId: number;
	orderId: string;
	quantity?: number;
	price?: number;
	triggerPrice?: number;
	validity?: string;
};

export type DhanCancelOrderRequest = {
	userId: number;
	tradingAccountId: number;
	orderId: string;
};

export type DhanBatchRequest = {
	batchSize?: number;
};
