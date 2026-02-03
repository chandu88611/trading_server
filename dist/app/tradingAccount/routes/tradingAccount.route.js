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
        // List all accounts for current user
        this.routes.get("/", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.listMyAccounts.bind(this.controller));
        // Get specific account by ID
        this.routes.get("/:id", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.getMyAccountById.bind(this.controller));
        // Create new account
        this.routes.post("/", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.createMyAccount.bind(this.controller));
        // Update account
        this.routes.patch("/:id", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.updateMyAccount.bind(this.controller));
        // Delete account
        this.routes.delete("/:id", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.deleteMyAccount.bind(this.controller));
    }
    getRouter() {
        return this.routes;
    }
}
exports.TradingAccountRouter = TradingAccountRouter;
