import { Router } from "express";
import { DeltaController } from "../controller/delta";
import { requireAuth, Roles } from "../../../middleware/auth";

export class DeltaRouter {
	private router: Router;

	constructor() {
		this.router = Router();
		this.initRoutes();
	}

	private initRoutes() {
		const controller = new DeltaController();

		this.router.get("/public/products", controller.publicProducts.bind(controller));
		this.router.get("/public/ticker", controller.publicTicker.bind(controller));
		this.router.get("/public/orderbook", controller.publicOrderbook.bind(controller));

		this.router.post(
			"/auth/token",
			requireAuth([Roles.USER, Roles.ADMIN]),
			controller.saveToken.bind(controller)
		);

		this.router.get(
			"/auth/token/status",
			requireAuth([Roles.USER, Roles.ADMIN]),
			controller.getTokenStatus.bind(controller)
		);

		this.router.post(
			"/auth/token/verify",
			requireAuth([Roles.USER, Roles.ADMIN]),
			controller.verifyToken.bind(controller)
		);

		this.router.delete(
			"/auth/token",
			requireAuth([Roles.USER, Roles.ADMIN]),
			controller.deleteToken.bind(controller)
		);

		this.router.post(
			"/orders/place",
			requireAuth([Roles.USER, Roles.ADMIN]),
			controller.placeOrder.bind(controller)
		);

		this.router.post(
			"/orders/modify",
			requireAuth([Roles.USER, Roles.ADMIN]),
			controller.modifyOrder.bind(controller)
		);

		this.router.post(
			"/orders/cancel",
			requireAuth([Roles.USER, Roles.ADMIN]),
			controller.cancelOrder.bind(controller)
		);

		this.router.post(
			"/orders",
			requireAuth([Roles.USER, Roles.ADMIN]),
			controller.getOrders.bind(controller)
		);

		this.router.get(
			"/orders",
			requireAuth([Roles.USER, Roles.ADMIN]),
			controller.getOrders.bind(controller)
		);

		this.router.post(
			"/positions",
			requireAuth([Roles.USER, Roles.ADMIN]),
			controller.getPositions.bind(controller)
		);

		this.router.get(
			"/positions",
			requireAuth([Roles.USER, Roles.ADMIN]),
			controller.getPositions.bind(controller)
		);

		this.router.post(
			"/holdings",
			requireAuth([Roles.USER, Roles.ADMIN]),
			controller.getHoldings.bind(controller)
		);

		this.router.get(
			"/holdings",
			requireAuth([Roles.USER, Roles.ADMIN]),
			controller.getHoldings.bind(controller)
		);

		this.router.post(
			"/execute-pending",
			requireAuth([Roles.ADMIN]),
			controller.executePending.bind(controller)
		);
	}

	getRouter() {
		return this.router;
	}
}