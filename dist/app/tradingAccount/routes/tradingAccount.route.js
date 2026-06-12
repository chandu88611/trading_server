"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingAccountRouter = void 0;
// src/app/tradingAccount/routes/tradingAccount.route.ts
const express_1 = require("express");
const auth_1 = require("../../../middleware/auth");
const tradingAccount_controller_1 = require("../controllers/tradingAccount.controller");
class TradingAccountRouter {
    constructor() {
        this.routes = (0, express_1.Router)();
        this.controller = new tradingAccount_controller_1.TradingAccountController();
        // GET /trading-accounts/me — all accounts for the logged-in user (no planId needed)
        // Must be registered BEFORE /:id to avoid Express matching "me" as an id param
        this.routes.get("/me", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.listMyAccountsMe.bind(this.controller));
        // GET /trading-accounts/:id/poll-key — MT5 poll key for EA configuration
        this.routes.get("/:id/poll-key", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.getMt5PollKey.bind(this.controller));
        // Create new account
        this.routes.post("/", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.createMyAccount.bind(this.controller));
        // Update account
        this.routes.patch("/:id", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.updateMyAccount.bind(this.controller));
        // Delete account
        this.routes.delete("/:id", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.deleteMyAccount.bind(this.controller));
        this.routes.post("/allow-copy-trading", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.allowCopyTrading.bind(this.controller));
        this.routes.get("/copy-trading-requests", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.getCopyTradingRequests.bind(this.controller));
        this.routes.post("/handle-copy-trading-request", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.handleCopyTradingRequest.bind(this.controller));
        this.routes.get("/", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.listMyAccounts.bind(this.controller));
        // Get specific account by ID
        this.routes.get("/:id", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.getMyAccountById.bind(this.controller));
    }
    getRouter() {
        return this.routes;
    }
}
exports.TradingAccountRouter = TradingAccountRouter;
