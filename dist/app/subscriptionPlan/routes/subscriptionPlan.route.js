"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionPlanRouter = void 0;
const express_1 = require("express");
const subscriptionPlan_controller_1 = require("../controller/subscriptionPlan.controller");
const auth_1 = require("../../../middleware/auth");
class SubscriptionPlanRouter {
    constructor() {
        this.router = (0, express_1.Router)();
        this.init();
    }
    init() {
        const controller = new subscriptionPlan_controller_1.SubscriptionPlanController();
        this.router.post("/admin/subscription-plan", (0, auth_1.requireAuth)([auth_1.Roles.ADMIN]), controller.createPlan.bind(controller));
        this.router.patch("/admin/subscription-plan/:planId", (0, auth_1.requireAuth)([auth_1.Roles.ADMIN]), controller.updatePlan.bind(controller));
        this.router.delete("/admin/subscription-plan/:planId", (0, auth_1.requireAuth)([auth_1.Roles.ADMIN]), controller.deletePlan.bind(controller));
        this.router.get("/admin/subscription-plan/:planId", (0, auth_1.requireAuth)([auth_1.Roles.ADMIN]), controller.getPlan.bind(controller));
        this.router.get("/admin/subscription-plan/all", (0, auth_1.requireAuth)([auth_1.Roles.ADMIN]), controller.getAll.bind(controller));
        this.router.get("/subscription-plan/list", controller.getActive.bind(controller));
    }
    getRouter() {
        return this.router;
    }
}
exports.SubscriptionPlanRouter = SubscriptionPlanRouter;
