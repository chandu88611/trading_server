import axios, { AxiosInstance } from "axios";

type SaveTokenInput = {
	userId: number;
	tradingAccountId: number;
	accessToken: string;
	apiKey?: string;
	baseUrl?: string;
};

type GenerateTokenInput = {
	userId: number;
	tradingAccountId: number;
	code: string;
	clientId: string;
	clientSecret: string;
	redirectUri: string;
};

type PlaceOrderInput = {
	userId: number;
	tradingAccountId: number;
	order: any;
};

type ModifyOrderInput = {
	userId: number;
	tradingAccountId: number;
	orderId: string;
	quantity?: number;
	price?: number;
	triggerPrice?: number;
	orderType?: string;
	validity?: string;
};

export class UpstoxService {
	private defaultBaseUrl = process.env.UPSTOX_BASE_URL || "https://api.upstox.com";

	private createClient(accessToken: string, baseUrl?: string): AxiosInstance {
		return axios.create({
			baseURL: baseUrl || this.defaultBaseUrl,
			timeout: 15000,
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
		});
	}

	async saveAuthToken(input: SaveTokenInput) {
		return this.saveTokenToDb({
			userId: input.userId,
			tradingAccountId: input.tradingAccountId,
			brokerCode: "UPSTOX",
			accessToken: input.accessToken,
			apiKey: input.apiKey,
			baseUrl: input.baseUrl || this.defaultBaseUrl,
		});
	}

	async generateAndSaveTokenUsingCode(input: GenerateTokenInput) {
		const body = new URLSearchParams();
		body.append("code", input.code);
		body.append("client_id", input.clientId);
		body.append("client_secret", input.clientSecret);
		body.append("redirect_uri", input.redirectUri);
		body.append("grant_type", "authorization_code");

		const response = await axios.post(
			`${this.defaultBaseUrl}/v2/login/authorization/token`,
			body.toString(),
			{
				timeout: 15000,
				headers: {
					Accept: "application/json",
					"Content-Type": "application/x-www-form-urlencoded",
				},
			}
		);

		const accessToken = response.data?.access_token;

		if (!accessToken) {
			throw {
				statusCode: 400,
				message: "upstox_access_token_missing",
				data: response.data,
			};
		}

		await this.saveAuthToken({
			userId: input.userId,
			tradingAccountId: input.tradingAccountId,
			accessToken,
			apiKey: input.clientId,
			baseUrl: this.defaultBaseUrl,
		});

		return {
			accessTokenSaved: true,
			raw: response.data,
		};
	}

	async placeOrder(input: PlaceOrderInput) {
		const auth = await this.getTokenFromDb(input.userId, input.tradingAccountId);
		const client = this.createClient(auth.accessToken, auth.baseUrl);

		const order = input.order;

		const payload = {
			quantity: Number(order.quantity),
			product: order.product || "I",
			validity: order.validity || "DAY",
			price: Number(order.price ?? 0),
			tag: order.tag || `tradebro-${Date.now()}`,
			instrument_token: order.instrumentToken,
			order_type: order.orderType || "MARKET",
			transaction_type: order.side,
			disclosed_quantity: Number(order.disclosedQuantity ?? 0),
			trigger_price: Number(order.triggerPrice ?? 0),
			is_amo: Boolean(order.isAmo ?? false),
		};

		const response = await client.post("/v2/order/place", payload);
		return response.data;
	}

	async modifyOrder(input: ModifyOrderInput) {
		const auth = await this.getTokenFromDb(input.userId, input.tradingAccountId);
		const client = this.createClient(auth.accessToken, auth.baseUrl);

		const payload: any = {
			order_id: input.orderId,
		};

		if (input.quantity !== undefined) payload.quantity = input.quantity;
		if (input.price !== undefined) payload.price = input.price;
		if (input.triggerPrice !== undefined) payload.trigger_price = input.triggerPrice;
		if (input.orderType) payload.order_type = input.orderType;
		if (input.validity) payload.validity = input.validity;

		const response = await client.put("/v2/order/modify", payload);
		return response.data;
	}

	async cancelOrder(input: { userId: number; tradingAccountId: number; orderId: string }) {
		const auth = await this.getTokenFromDb(input.userId, input.tradingAccountId);
		const client = this.createClient(auth.accessToken, auth.baseUrl);

		const response = await client.delete("/v2/order/cancel", {
			params: {
				order_id: input.orderId,
			},
		});

		return response.data;
	}

	async getOrders(userId: number, tradingAccountId: number) {
		const auth = await this.getTokenFromDb(userId, tradingAccountId);
		const client = this.createClient(auth.accessToken, auth.baseUrl);

		const response = await client.get("/v2/order/retrieve-all");
		return response.data;
	}

	async getPositions(userId: number, tradingAccountId: number) {
		const auth = await this.getTokenFromDb(userId, tradingAccountId);
		const client = this.createClient(auth.accessToken, auth.baseUrl);

		const response = await client.get("/v2/portfolio/short-term-positions");
		return response.data;
	}

	async getHoldings(userId: number, tradingAccountId: number) {
		const auth = await this.getTokenFromDb(userId, tradingAccountId);
		const client = this.createClient(auth.accessToken, auth.baseUrl);

		const response = await client.get("/v2/portfolio/long-term-holdings");
		return response.data;
	}

	async getFunds(userId: number, tradingAccountId: number) {
		const auth = await this.getTokenFromDb(userId, tradingAccountId);
		const client = this.createClient(auth.accessToken, auth.baseUrl);

		const response = await client.get("/v2/user/get-funds-and-margin");
		return response.data;
	}

	async executePendingBatch(input: { batchSize?: number }) {
		const batchSize = input.batchSize || 25;

		// TODO:
		// 1. Fetch pending trades where brokerCode = UPSTOX
		// 2. Mark PROCESSING
		// 3. Resolve instrumentToken
		// 4. Place order
		// 5. Mark EXECUTED / FAILED

		return {
			brokerCode: "UPSTOX",
			batchSize,
			message: "connect_with_existing_pending_trade_worker",
		};
	}

	private async saveTokenToDb(input: {
		userId: number;
		tradingAccountId: number;
		brokerCode: string;
		accessToken: string;
		apiKey?: string;
		baseUrl?: string;
	}) {
		// TODO:
		// Replace this with the same DB/token save logic used in ZebuService.
		// Store accessToken encrypted if your Zebu implementation already encrypts broker tokens.

		return {
			userId: input.userId,
			tradingAccountId: input.tradingAccountId,
			brokerCode: input.brokerCode,
			baseUrl: input.baseUrl,
			tokenSaved: true,
			note: "replace_saveTokenToDb_with_existing_trading_account_token_save_logic",
		};
	}

	private async getTokenFromDb(userId: number, tradingAccountId: number): Promise<{
		accessToken: string;
		baseUrl?: string;
	}> {
		// TODO:
		// Replace this with the same token fetch/decrypt logic used in ZebuService.

		throw {
			statusCode: 400,
			message: "implement_getTokenFromDb_for_upstox",
			data: {
				userId,
				tradingAccountId,
			},
		};
	}
}
