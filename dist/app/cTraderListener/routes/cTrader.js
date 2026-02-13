"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CTraderRoutes = void 0;
const express_1 = require("express");
const cTrader_1 = require("../controller/cTrader");
class CTraderRoutes {
    constructor() {
        this.router = (0, express_1.Router)();
        this.initRoutes();
    }
    initRoutes() {
        const controller = new cTrader_1.CTraderController();
        this.router.post("/oauth/exchange", controller.generateTokens.bind(controller));
        this.router.get("/callback", controller.oauthCallback.bind(controller));
    }
    getRouter() {
        return this.router;
    }
}
exports.CTraderRoutes = CTraderRoutes;
