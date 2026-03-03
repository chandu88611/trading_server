export type ZebuAuthPayload = {
	userId: number;
	tradingAccountId: number;
	accessToken: string;
	baseUrl?: string;
	apiKey?: string;
};

export type ZebuGenerateTokenRequest = {
	userId: number;
	tradingAccountId: number;
	password: string;
	totp: string;
};

export type ZebuOrderPayload = {
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

export type ZebuPlaceOrderRequest = {
	userId: number;
	tradingAccountId: number;
	order: ZebuOrderPayload;
};

export type ZebuModifyOrderRequest = {
	userId: number;
	tradingAccountId: number;
	orderId: string;
	quantity?: number;
	price?: number;
	triggerPrice?: number;
	validity?: string;
};

export type ZebuCancelOrderRequest = {
	userId: number;
	tradingAccountId: number;
	orderId: string;
};

export type ZebuBatchRequest = {
	batchSize?: number;
};
