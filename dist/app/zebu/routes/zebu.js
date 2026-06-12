"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZebuRouter = void 0;
const express_1 = require("express");
const zebu_1 = require("../controller/zebu");
const auth_1 = require("../../../middleware/auth");
class ZebuRouter {
    constructor() {
        this.router = (0, express_1.Router)();
        this.initRoutes();
    }
    initRoutes() {
        const controller = new zebu_1.ZebuController();
        this.router.post("/auth/token", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), controller.saveToken.bind(controller));
        this.router.post("/auth/token/generate", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), controller.generateToken.bind(controller));
        this.router.post("/orders/place", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), controller.placeOrder.bind(controller));
        this.router.post("/orders/modify", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), controller.modifyOrder.bind(controller));
        this.router.post("/orders/cancel", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), controller.cancelOrder.bind(controller));
        this.router.post("/orders", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), controller.getOrders.bind(controller));
        this.router.get("/orders", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), controller.getOrders.bind(controller));
        this.router.post("/positions", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), controller.getPositions.bind(controller));
        this.router.get("/positions", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), controller.getPositions.bind(controller));
        this.router.post("/holdings", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), controller.getHoldings.bind(controller));
        this.router.get("/holdings", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), controller.getHoldings.bind(controller));
        this.router.get("/funds", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), controller.getFunds.bind(controller));
        this.router.post("/execute-pending", (0, auth_1.requireAuth)([auth_1.Roles.ADMIN]), controller.executePending.bind(controller));
    }
    getRouter() {
        return this.router;
    }
}
exports.ZebuRouter = ZebuRouter;
