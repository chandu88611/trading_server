import { Router } from "express";
import { DhanController } from "../controller/dhan";
import { requireAuth, Roles } from "../../../middleware/auth";

export class DhanRouter {
	private router: Router;

	constructor() {
		this.router = Router();
		this.initRoutes();
	}

	private initRoutes() {
		const controller = new DhanController();

		this.router.post("/auth/token", requireAuth([Roles.USER, Roles.ADMIN]),controller.saveToken.bind(controller));
		this.router.post("/auth/token/generate", requireAuth([Roles.USER, Roles.ADMIN]), controller.generateToken.bind(controller));

		this.router.post("/orders/place", requireAuth([Roles.USER, Roles.ADMIN]), controller.placeOrder.bind(controller));
		this.router.post("/orders/modify", requireAuth([Roles.USER, Roles.ADMIN]), controller.modifyOrder.bind(controller));
		this.router.post("/orders/cancel", requireAuth([Roles.USER, Roles.ADMIN]), controller.cancelOrder.bind(controller));

		this.router.post("/orders", requireAuth([Roles.USER, Roles.ADMIN]), controller.getOrders.bind(controller));
		this.router.post("/positions", requireAuth([Roles.USER, Roles.ADMIN]), controller.getPositions.bind(controller));
		this.router.post("/holdings", requireAuth([Roles.USER, Roles.ADMIN]), controller.getHoldings.bind(controller));

		this.router.post("/execute-pending", requireAuth([Roles.USER, Roles.ADMIN]), controller.executePending.bind(controller));
	}

	getRouter() {
		return this.router;
	}
}
