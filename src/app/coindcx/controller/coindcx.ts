import { Request, Response } from "express";
import { ControllerError } from "../../../types/error-handler";
import { HttpStatusCode } from "../../../types/constants";
import { CoinDCXService } from "../services/coindcx.service";

export class CoinDCXController {
	private service = new CoinDCXService();

	private requireUserId(req: Request): number {
		const userId = Number((req as any)?.auth?.userId ?? (req.body as any)?.userId ?? (req.query as any)?.userId);
		if (!Number.isFinite(userId) || userId <= 0) {
			throw { statusCode: HttpStatusCode._UNAUTHORISED, message: "userId_required" };
		}
		return userId;
	}

	private requireTradingAccountId(req: Request): number {
		const id = Number((req.body as any)?.tradingAccountId ?? (req.query as any)?.tradingAccountId);
		if (!Number.isFinite(id) || id <= 0) {
			throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "tradingAccountId_required" };
		}
		return id;
	}

	@ControllerError()
	async saveToken(req: Request, res: Response) {
		const userId = this.requireUserId(req);
		const tradingAccountId = this.requireTradingAccountId(req);

		const apiKey = String((req.body as any)?.apiKey ?? "").trim();
		const apiSecret = String((req.body as any)?.apiSecret ?? "").trim();
		const baseUrl = String((req.body as any)?.baseUrl ?? "").trim() || undefined;

		if (!apiKey || !apiSecret) {
			return res.status(HttpStatusCode._BAD_REQUEST).json({ message: "apiKey_apiSecret_required" });
		}

		const result = await this.service.saveAuthToken({
			userId,
			tradingAccountId,
			apiKey,
			apiSecret,
			baseUrl,
		});

		return res.json({ message: "coindcx_credentials_saved", data: result });
	}

	@ControllerError()
	async placeOrder(req: Request, res: Response) {
		const userId = this.requireUserId(req);
		const tradingAccountId = this.requireTradingAccountId(req);
		const order = (req.body as any)?.order;

		if (!order || !order.symbol || !order.side || !order.quantity) {
			return res.status(HttpStatusCode._BAD_REQUEST).json({ message: "invalid_order_payload" });
		}

		const result = await this.service.placeOrder({
			userId,
			tradingAccountId,
			order,
		});

		return res.json({ message: "order_placed", data: result });
	}

	@ControllerError()
	async modifyOrder(req: Request, res: Response) {
		const userId = this.requireUserId(req);
		const tradingAccountId = this.requireTradingAccountId(req);
		const orderId = String((req.body as any)?.orderId ?? "").trim();

		if (!orderId) {
			return res.status(HttpStatusCode._BAD_REQUEST).json({ message: "orderId_required" });
		}

		const result = await this.service.modifyOrder({
			userId,
			tradingAccountId,
			orderId,
			quantity: (req.body as any)?.quantity,
			price: (req.body as any)?.price,
		});

		return res.json({ message: "order_modified", data: result });
	}

	@ControllerError()
	async cancelOrder(req: Request, res: Response) {
		const userId = this.requireUserId(req);
		const tradingAccountId = this.requireTradingAccountId(req);
		const orderId = String((req.body as any)?.orderId ?? "").trim();

		if (!orderId) {
			return res.status(HttpStatusCode._BAD_REQUEST).json({ message: "orderId_required" });
		}

		const result = await this.service.cancelOrder({ userId, tradingAccountId, orderId });
		return res.json({ message: "order_cancelled", data: result });
	}

	@ControllerError()
	async getOrders(req: Request, res: Response) {
		const userId = this.requireUserId(req);
		const tradingAccountId = this.requireTradingAccountId(req);
		const data = await this.service.getOrders(userId, tradingAccountId);
		return res.json({ message: "orders", data });
	}

	@ControllerError()
	async getPositions(req: Request, res: Response) {
		const userId = this.requireUserId(req);
		const tradingAccountId = this.requireTradingAccountId(req);
		const data = await this.service.getPositions(userId, tradingAccountId);
		return res.json({ message: "positions", data });
	}

	@ControllerError()
	async getHoldings(req: Request, res: Response) {
		const userId = this.requireUserId(req);
		const tradingAccountId = this.requireTradingAccountId(req);
		const data = await this.service.getHoldings(userId, tradingAccountId);
		return res.json({ message: "holdings", data });
	}

	@ControllerError()
	async executePending(req: Request, res: Response) {
		const batchSize = Number((req.body as any)?.batchSize ?? undefined);
		const data = await this.service.executePendingBatch({
			batchSize: Number.isFinite(batchSize) ? batchSize : undefined,
		});
		return res.json({ message: "executed", data });
	}

	@ControllerError()
	async publicTicker(req: Request, res: Response) {
		const market = String((req.query as any)?.market ?? "").trim() || undefined;
		const data = await this.service.getPublicTicker({ market });
		return res.json({ message: "ticker", data });
	}

	@ControllerError()
	async publicOrderbook(req: Request, res: Response) {
		const market = String((req.query as any)?.market ?? (req.query as any)?.symbol ?? "").trim();
		if (!market) {
			return res.status(HttpStatusCode._BAD_REQUEST).json({ message: "market_required" });
		}

		const data = await this.service.getPublicOrderbook({ market });
		return res.json({ message: "orderbook", data });
	}
}
