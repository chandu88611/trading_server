"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSubscriptionRouter = void 0;
const express_1 = require("express");
const userSubscription_controller_1 = require("../controller/userSubscription.controller");
const auth_1 = require("../../../middleware/auth");
class UserSubscriptionRouter {
    constructor() {
        this.router = (0, express_1.Router)();
        this.initRoutes();
    }
    initRoutes() {
        const controller = new userSubscription_controller_1.UserSubscriptionController();
        // ---- User routes ----
        this.router.post("/subscription/subscribe", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), controller.subscribe.bind(controller));
        this.router.post("/subscription/cancel", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), controller.cancel.bind(controller));
        this.router.get("/subscription/current", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), controller.current.bind(controller));
        this.router.get("/subscription/follower-user-trading-account", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), controller.followerUserTradingAccount.bind(controller));
        this.router.get("/admin/subscription/user/:userId", (0, auth_1.requireAuth)([auth_1.Roles.ADMIN, auth_1.Roles.USER]), controller.getUserSubscriptions.bind(controller));
        this.router.get("/admin/subscription/all", (0, auth_1.requireAuth)([auth_1.Roles.ADMIN, auth_1.Roles.USER]), controller.adminGetAll.bind(controller));
        this.router.post("/admin/subscription/update-webhook", (0, auth_1.requireAuth)([auth_1.Roles.ADMIN, auth_1.Roles.USER]), controller.updateWebhookStatus.bind(controller));
    }
    getRouter() {
        return this.router;
    }
}
exports.UserSubscriptionRouter = UserSubscriptionRouter;
