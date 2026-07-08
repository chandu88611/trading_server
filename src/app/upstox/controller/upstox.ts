import { Request, Response } from "express";
import { ControllerError } from "../../../types/error-handler";
import { HttpStatusCode } from "../../../types/constants";
import { Roles } from "../../../middleware/auth";
import { UpstoxService } from "../services/upstox.service";

export class UpstoxController {
	private service = new UpstoxService();

	private requireUserId(req: Request): number {
		const userId = Number((req as any)?.auth?.userId);
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

	private requireAdmin(req: Request) {
		const roles = ((req as any)?.auth?.roles ?? []) as string[];
		if (!roles.includes(Roles.ADMIN)) {
			throw { statusCode: HttpStatusCode._UNAUTHORISED, message: "Admin access required" };
		}
	}

	private optionalNumber(value: unknown): number | undefined {
		if (value === undefined || value === null || value === "") return undefined;
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}

	@ControllerError()
	async saveToken(req: Request, res: Response) {
		const userId = this.requireUserId(req);
		const tradingAccountId = this.requireTradingAccountId(req);

		const accessToken = String((req.body as any)?.accessToken ?? "").trim();
		const apiKey = String((req.body as any)?.apiKey ?? (req.body as any)?.clientId ?? "").trim() || undefined;
		const baseUrl = String((req.body as any)?.baseUrl ?? process.env.UPSTOX_BASE_URL ?? "https://api.upstox.com").trim();

		if (!accessToken) {
			return res.status(HttpStatusCode._BAD_REQUEST).json({ message: "accessToken_required" });
		}

		const result = await this.service.saveAuthToken({
			userId,
			tradingAccountId,
			accessToken,
			apiKey,
			baseUrl,
		});

		return res.json({ message: "upstox_token_saved", data: result });
	}

	@ControllerError()
	async generateToken(req: Request, res: Response) {
		const userId = this.requireUserId(req);
		const tradingAccountId = this.requireTradingAccountId(req);

		const code = String((req.body as any)?.code ?? "").trim();
		const clientId = String((req.body as any)?.clientId ?? process.env.UPSTOX_CLIENT_ID ?? "").trim();
		const clientSecret = String((req.body as any)?.clientSecret ?? process.env.UPSTOX_CLIENT_SECRET ?? "").trim();
		const redirectUri = String((req.body as any)?.redirectUri ?? process.env.UPSTOX_REDIRECT_URI ?? "").trim();

		if (!code) {
			return res.status(HttpStatusCode._BAD_REQUEST).json({ message: "code_required" });
		}

		if (!clientId) {
			return res.status(HttpStatusCode._BAD_REQUEST).json({ message: "clientId_required" });
		}

		if (!clientSecret) {
			return res.status(HttpStatusCode._BAD_REQUEST).json({ message: "clientSecret_required" });
		}

		if (!redirectUri) {
			return res.status(HttpStatusCode._BAD_REQUEST).json({ message: "redirectUri_required" });
		}

		const result = await this.service.generateAndSaveTokenUsingCode({
			userId,
			tradingAccountId,
			code,
			clientId,
			clientSecret,
			redirectUri,
		});

		return res.json({ message: "upstox_token_generated", data: result });
	}

	@ControllerError()
	async placeOrder(req: Request, res: Response) {
		const userId = this.requireUserId(req);
		const tradingAccountId = this.requireTradingAccountId(req);
		const order = (req.body as any)?.order;

		if (!order || !order.instrumentToken || !order.side || !order.quantity) {
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
			quantity: this.optionalNumber((req.body as any)?.quantity),
			price: this.optionalNumber((req.body as any)?.price),
			triggerPrice: this.optionalNumber((req.body as any)?.triggerPrice),
			orderType: String((req.body as any)?.orderType ?? "").trim() || undefined,
			validity: String((req.body as any)?.validity ?? "").trim() || undefined,
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
	async getFunds(req: Request, res: Response) {
		const userId = this.requireUserId(req);
		const tradingAccountId = this.requireTradingAccountId(req);
		const data = await this.service.getFunds(userId, tradingAccountId);
		return res.json({ data });
	}

	@ControllerError()
	async executePending(req: Request, res: Response) {
		this.requireAdmin(req);

		const batchSize = Number((req.body as any)?.batchSize ?? undefined);
		const data = await this.service.executePendingBatch({
			batchSize: Number.isFinite(batchSize) ? batchSize : undefined,
		});

		return res.json({ message: "executed", data });
	}
}
