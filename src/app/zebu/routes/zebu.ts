import { Router } from "express";
import { ZebuController } from "../controller/zebu";

export class ZebuRouter {
	private router: Router;

	constructor() {
		this.router = Router();
		this.initRoutes();
	}

	private initRoutes() {
		const controller = new ZebuController();

		this.router.post("/auth/token", controller.saveToken.bind(controller));

		this.router.post("/orders/place", controller.placeOrder.bind(controller));
		this.router.post("/orders/modify", controller.modifyOrder.bind(controller));
		this.router.post("/orders/cancel", controller.cancelOrder.bind(controller));

		this.router.post("/orders", controller.getOrders.bind(controller));
		this.router.post("/positions", controller.getPositions.bind(controller));
		this.router.post("/holdings", controller.getHoldings.bind(controller));

		this.router.post("/execute-pending", controller.executePending.bind(controller));
	}

	getRouter() {
		return this.router;
	}
}
