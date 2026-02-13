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
        // Create a new trade
        this.routes.post("/", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.create.bind(this.controller));
        // Get all trades for a user
        this.routes.get("/all", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.getAllTrades.bind(this.controller));
        // TODO: Add endpoints for:
        // GET /trades - list user trades with pagination and filters
        this.routes.get("/", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.getAllTrades.bind(this.controller));
        // GET /trades/:id - get trade details
        // GET /trades/history - get trade history with stats
    }
    getRouter() {
        return this.routes;
    }
}
exports.TradeRouter = TradeRouter;
