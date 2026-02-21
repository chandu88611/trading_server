"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeRouter = void 0;
// src/app/trade/routes/trade.route.ts
const express_1 = require("express");
const auth_1 = require("../../../middleware/auth");
const trade_controller_1 = require("../controllers/trade.controller");
class TradeRouter {
    constructor() {
        this.routes = (0, express_1.Router)();
        this.controller = new trade_controller_1.TradeController();
        this.routes.get("/all", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.getAllTrades.bind(this.controller));
        this.routes.get("/", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.getSingleTrade.bind(this.controller));
        this.routes.get("/history", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.getTradeHistory.bind(this.controller));
        this.routes.post("/close", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.closeTrade.bind(this.controller));
    }
    getRouter() {
        return this.routes;
    }
}
exports.TradeRouter = TradeRouter;
