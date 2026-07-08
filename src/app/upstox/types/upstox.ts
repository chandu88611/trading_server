export enum UpstoxTradeStatus {
	PENDING = "pending",
	PROCESSING = "processing",
	EXECUTED = "executed",
	FAILED = "failed",
}

export enum UpstoxAuthMode {
	PASTE_TOKEN = "PASTE_TOKEN",
	AUTH_CODE = "AUTH_CODE",
}

export type UpstoxOrderSide = "BUY" | "SELL";

export type UpstoxOrderPayload = {
	instrumentToken: string;
	side: UpstoxOrderSide;
	quantity: number;
	orderType?: "MARKET" | "LIMIT" | "SL" | "SL-M";
	product?: "I" | "D" | "CO" | "OCO" | "MTF";
	validity?: "DAY" | "IOC";
	price?: number;
	triggerPrice?: number;
	disclosedQuantity?: number;
	isAmo?: boolean;
	tag?: string;
};
