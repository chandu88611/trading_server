import { Router } from "express";
import { ZebuController } from "../controller/zebu";
import { requireAuth, Roles } from "../../../middleware/auth";

export class ZebuRouter {
	private router: Router;

	constructor() {
		this.router = Router();
		this.initRoutes();
	}

	private initRoutes() {
		const controller = new ZebuController();

		this.router.post("/auth/token", requireAuth([Roles.USER, Roles.ADMIN]), controller.saveToken.bind(controller));
		this.router.post("/auth/token/generate", requireAuth([Roles.USER, Roles.ADMIN]), controller.generateToken.bind(controller));

		this.router.post("/orders/place", requireAuth([Roles.USER, Roles.ADMIN]), controller.placeOrder.bind(controller));
		this.router.post("/orders/modify", requireAuth([Roles.USER, Roles.ADMIN]), controller.modifyOrder.bind(controller));
		this.router.post("/orders/cancel", requireAuth([Roles.USER, Roles.ADMIN]), controller.cancelOrder.bind(controller));

		this.router.post("/orders", requireAuth([Roles.USER, Roles.ADMIN]), controller.getOrders.bind(controller));
		this.router.get("/orders", requireAuth([Roles.USER, Roles.ADMIN]), controller.getOrders.bind(controller));
		this.router.post("/positions", requireAuth([Roles.USER, Roles.ADMIN]), controller.getPositions.bind(controller));
		this.router.get("/positions", requireAuth([Roles.USER, Roles.ADMIN]), controller.getPositions.bind(controller));
		this.router.post("/holdings", requireAuth([Roles.USER, Roles.ADMIN]), controller.getHoldings.bind(controller));
		this.router.get("/holdings", requireAuth([Roles.USER, Roles.ADMIN]), controller.getHoldings.bind(controller));
		this.router.get("/funds", requireAuth([Roles.USER, Roles.ADMIN]), controller.getFunds.bind(controller));

		this.router.post("/execute-pending", requireAuth([Roles.ADMIN]), controller.executePending.bind(controller));
	}

	getRouter() {
		return this.router;
	}
}
