"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionPlanRouter = void 0;
// src/app/subscriptionPlan/routes/subscriptionPlan.routes.ts
const express_1 = require("express");
const subscriptionPlan_controller_1 = require("../controller/subscriptionPlan.controller");
class SubscriptionPlanRouter {
    constructor() {
        this.router = (0, express_1.Router)();
        this.init();
    }
    init() {
        const controller = new subscriptionPlan_controller_1.SubscriptionPlanController();
        // ✅ IMPORTANT: "all" must come BEFORE ":planId"
        this.router.get("/subscription-plan/all", 
        // requireAuth([Roles.ADMIN]),
        controller.getAll.bind(controller));
        this.router.post("/subscription-plan", 
        // requireAuth([Roles.ADMIN]),
        controller.createPlan.bind(controller));
        this.router.patch("/subscription-plan/:planId", 
        // requireAuth([Roles.ADMIN]),
        controller.updatePlan.bind(controller));
        this.router.delete("/subscription-plan/:planId", 
        // requireAuth([Roles.ADMIN]),
        controller.deletePlan.bind(controller));
        this.router.get("/subscription-plan/:planId", 
        // requireAuth([Roles.ADMIN]),
        controller.getPlan.bind(controller));
        this.router.get("/subscription-plan/list", controller.getActive.bind(controller));
    }
    getRouter() {
        return this.router;
    }
}
exports.SubscriptionPlanRouter = SubscriptionPlanRouter;
