"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZebuRouter = void 0;
const express_1 = require("express");
const zebu_1 = require("../controller/zebu");
class ZebuRouter {
    constructor() {
        this.router = (0, express_1.Router)();
        this.initRoutes();
    }
    initRoutes() {
        const controller = new zebu_1.ZebuController();
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
exports.ZebuRouter = ZebuRouter;
