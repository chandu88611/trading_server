import { encrypt, decrypt, encryptCredentials } from "../../../utils/crypto";
import AppDataSource from "../../../db/data-source";
import { UserTradingAccount } from "../../../entity/UserTradingAccount";
import { TradeSignal } from "../../../entity/TradeSignals";
import { TradingAccountStatus } from "../../subscriptionPlan/enums/subscriberPlan.enum";
import { TradeGuardService, isExitSignal } from "../../trade/services/tradeGuard.service";
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
        const trades = await AppDataSource.transaction(async manager => {
            const rows = await manager.query(`SELECT ts.id, st.status FROM trade_signals ts JOIN trade_signals_status st ON st.signal_id=ts.id JOIN user_trading_accounts a ON a.id=ts.trading_account_id JOIN brokers b ON b.id=a.broker_id WHERE b.code='UPSTOX' AND st.status IN ('pending','pending_close') ORDER BY ts.id LIMIT $1 FOR UPDATE OF st SKIP LOCKED`, [Math.max(1, Math.min(input.batchSize ?? 25, 100))]);
            const jobs: TradeSignal[] = [];
            for (const row of rows) {
                await manager.query(`UPDATE trade_signals_status SET status=$2, updated_at=NOW() WHERE signal_id=$1`, [row.id, row.status === "pending_close" ? "in_progress_close" : "in_progress"]);
                const job = await manager.findOne(TradeSignal, { where: { id: row.id }, relations: ["tradingAccount", "tradingAccount.broker", "status"] });
                if (job) jobs.push(job);
            }
            return jobs;
        });
        for (const job of trades) {
            if (!(await new TradeGuardService().validateTrade(job.tradingAccount, job)).allowed) continue;
            try {
                if (!job.instrumentToken) throw new Error("upstox_instrument_token_required");
                const closing = isExitSignal(job);
                if (closing && !job.brokerOrderId) throw new Error("upstox_close_requires_entry_order");
                const side = String(job.action).toUpperCase();
                if (!["BUY", "SELL"].includes(side)) throw new Error("invalid_order_side");
                const quantity = Number(job.volume);
                if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("invalid_order_quantity");
                const response = await this.placeOrder({ userId: Number(job.tradingAccount.userId), tradingAccountId: job.tradingAccount.id, order: {
                    instrumentToken: job.instrumentToken, quantity,
                    side: closing ? side === "BUY" ? "SELL" : "BUY" : side,
                    product: ["C", "CNC", "DELIVERY"].includes(String(job.product)) ? "D" : "I",
                    orderType: closing ? "MARKET" : String(job.orderType ?? "MARKET").replace("_order", "").toUpperCase(),
                    price: closing ? 0 : Number(job.limitPrice ?? 0), triggerPrice: Number(job.stopPrice ?? 0), tag: `tradebro-${job.id}${closing ? "-close" : ""}`,
                } });
                const orderId = response?.data?.order_id;
                if (!orderId) throw new Error("upstox_order_id_missing");
                await AppDataSource.transaction(async manager => {
                    if (!closing) await manager.query(`UPDATE trade_signals SET broker_order_id=$2 WHERE id=$1`, [job.id, String(orderId)]);
                    await manager.query(`UPDATE trade_signals_status SET status=$2, last_error=NULL, updated_at=NOW() WHERE signal_id=$1`, [job.id, closing ? "closed" : "executed"]);
                });
            } catch (error: any) {
                console.error("[UPSTOX] execution failed", { signalId: job.id, error });
                await AppDataSource.query(`UPDATE trade_signals_status SET status='failed', last_error=$2, attempts=attempts+1, updated_at=NOW() WHERE signal_id=$1`, [job.id, error?.stack ?? error?.message ?? String(error)]);
            }
        }
        return { processed: trades.length };
    }

    private async saveTokenToDb(input: { userId: number; tradingAccountId: number; brokerCode: string; accessToken: string; apiKey?: string; baseUrl?: string }) {
        const repo = AppDataSource.getRepository(UserTradingAccount);
        const account = await repo.findOne({ where: { id: input.tradingAccountId, userId: input.userId, broker: { code: "UPSTOX" } }, relations: ["broker"] });
        if (!account) throw { statusCode: 404, message: "trading_account_not_found" };
        // Verify with Upstox before recording the account as ready.
        await this.createClient(input.accessToken).get("/v2/user/get-funds-and-margin");
        account.accessToken = encrypt(input.accessToken);
        account.status = TradingAccountStatus.VERIFIED;
        account.lastVerifiedAt = new Date();
        account.accountMeta = encryptCredentials({ ...(account.accountMeta ?? {}), upstox: { apiKey: input.apiKey, baseUrl: this.defaultBaseUrl } });
        await repo.save(account);
        return { tokenSaved: true, tradingAccountId: account.id, verifiedAt: account.lastVerifiedAt };
    }

    private async getTokenFromDb(userId: number, tradingAccountId: number): Promise<{ accessToken: string; baseUrl?: string }> {
        const account = await AppDataSource.getRepository(UserTradingAccount).findOne({ where: { id: tradingAccountId, userId, broker: { code: "UPSTOX" } }, relations: ["broker"] });
        if (!account?.accessToken) throw { statusCode: 400, message: "upstox_token_missing" };
        return { accessToken: decrypt(account.accessToken), baseUrl: this.defaultBaseUrl };
    }
}
