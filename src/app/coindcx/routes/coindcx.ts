import { Router } from "express";
import { CoinDCXController } from "../controller/coindcx";
import { requireAuth, Roles } from "../../../middleware/auth";

export class CoinDCXRouter {
	private readonly router: Router;

	constructor() {
		this.router = Router();
		this.initRoutes();
	}

	private initRoutes() {
		const controller = new CoinDCXController();
		const userOrAdmin = requireAuth([Roles.USER, Roles.ADMIN]);

		// Public market APIs
		this.router.get(
			"/public/ticker",
			controller.publicTicker.bind(controller)
		);

		this.router.get(
			"/public/orderbook",
			controller.publicOrderbook.bind(controller)
		);

		// Public CoinDCX futures instrument metadata
		this.router.get(
			"/futures/instruments",
			controller.getFuturesInstruments.bind(controller)
		);

		this.router.get(
			"/futures/public/instruments",
			controller.getFuturesInstruments.bind(controller)
		);

		// Authentication and credentials
		this.router.post(
			"/auth/token",
			userOrAdmin,
			controller.saveToken.bind(controller)
		);

		this.router.get(
			"/auth/token/status",
			userOrAdmin,
			controller.getTokenStatus.bind(controller)
		);

		this.router.post(
			"/auth/token/verify",
			userOrAdmin,
			controller.verifyToken.bind(controller)
		);

		this.router.delete(
			"/auth/token",
			userOrAdmin,
			controller.deleteToken.bind(controller)
		);

		// Spot orders
		this.router.post(
			"/orders/place",
			userOrAdmin,
			controller.placeOrder.bind(controller)
		);

		this.router.post(
			"/orders/modify",
			userOrAdmin,
			controller.modifyOrder.bind(controller)
		);

		this.router.post(
			"/orders/cancel",
			userOrAdmin,
			controller.cancelOrder.bind(controller)
		);

		this.router.get(
			"/orders",
			userOrAdmin,
			controller.getOrders.bind(controller)
		);

		this.router.post(
			"/orders",
			userOrAdmin,
			controller.getOrders.bind(controller)
		);

		// Futures wallet and order APIs
		this.router.get(
			"/futures/wallets",
			userOrAdmin,
			controller.getFuturesWallets.bind(controller)
		);

		this.router.post(
			"/futures/orders/place",
			userOrAdmin,
			controller.placeFuturesOrder.bind(controller)
		);

		// Futures positions
		this.router.get(
			"/futures/positions",
			userOrAdmin,
			controller.getFuturesPositions.bind(controller)
		);

		this.router.post(
			"/futures/positions",
			userOrAdmin,
			controller.getFuturesPositions.bind(controller)
		);

		this.router.post(
			"/futures/positions/tpsl",
			userOrAdmin,
			controller.createFuturesTPSL.bind(controller)
		);

		this.router.post(
			"/futures/positions/exit",
			userOrAdmin,
			controller.exitFuturesPosition.bind(controller)
		);

		this.router.post(
			"/futures/positions/cancel-open-orders",
			userOrAdmin,
			controller.cancelFuturesOpenOrdersForPosition.bind(controller)
		);

		// Spot positions
		this.router.get(
			"/positions",
			userOrAdmin,
			controller.getPositions.bind(controller)
		);

		this.router.post(
			"/positions",
			userOrAdmin,
			controller.getPositions.bind(controller)
		);

		// Holdings
		this.router.get(
			"/holdings",
			userOrAdmin,
			controller.getHoldings.bind(controller)
		);

		this.router.post(
			"/holdings",
			userOrAdmin,
			controller.getHoldings.bind(controller)
		);

		// Balances and account summary
		this.router.get(
			"/balances",
			userOrAdmin,
			controller.getBalances.bind(controller)
		);

		this.router.get(
			"/account-summary",
			userOrAdmin,
			controller.getAccountSummary.bind(controller)
		);

		// Background execution
		this.router.post(
			"/execute-pending",
			requireAuth([Roles.ADMIN]),
			controller.executePending.bind(controller)
		);
	}

	getRouter(): Router {
		return this.router;
	}
}