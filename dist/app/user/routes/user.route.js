"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRouter = void 0;
const express_1 = require("express");
const controllers_1 = require("../controllers");
const auth_1 = require("../../../middleware/auth");
const rateLimit_1 = require("../../../middleware/rateLimit");
const validate_1 = require("../../../middleware/validate");
class UserRouter {
    constructor() {
        this.userRoutes = (0, express_1.Router)();
        this.initApplicationRoutes();
    }
    initApplicationRoutes() {
        const userController = new controllers_1.UserController();
        this.userRoutes.post("/register", 
        // invoke factory to get actual middleware
        (0, rateLimit_1.createRateLimiter)({ max: 10, windowMs: 60000 }), validate_1.validateRegister, userController.registerUser.bind(userController));
        this.userRoutes.get("/verify-email", (0, rateLimit_1.createRateLimiter)({ max: 20, windowMs: 60000 }), userController.verifyEmail.bind(userController));
        this.userRoutes.get("/", (0, auth_1.requireAuth)([auth_1.Roles.ADMIN]), userController.listUsers.bind(userController));
        this.userRoutes.get("/referral", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), userController.getReferral.bind(userController));
        this.userRoutes.get("/:userId/referral", (0, auth_1.requireAuth)([auth_1.Roles.ADMIN]), userController.getUserReferral.bind(userController));
        this.userRoutes.patch("/:userId/admin", (0, auth_1.requireAuth)([auth_1.Roles.ADMIN]), userController.updateAdminStatus.bind(userController));
        this.userRoutes.get("/billing", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), userController.getBillingDetails.bind(userController));
        this.userRoutes.put("/billing", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), userController.updateBillingDetails.bind(userController));
        this.userRoutes.put("/copy-trade-status", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), userController.updateCopyTradeStatus.bind(userController));
        this.userRoutes.put("/trade-status", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), userController.updateTradeStatus.bind(userController));
        this.userRoutes.get("/edging-status", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), userController.getEdgingStatus.bind(userController));
        this.userRoutes.put("/edging-status", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), userController.updateEdgingStatus.bind(userController));
        this.userRoutes.put("/risk-limits", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), userController.updateRiskLimits.bind(userController));
        this.userRoutes.get("/me", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), userController.getUserDetails.bind(userController));
        this.userRoutes.get("/dashboard", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), userController.getDashboard.bind(userController));
        this.userRoutes.get("/settings", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), userController.getSettings.bind(userController));
        this.userRoutes.get("/admin/strategy-trade-schedule", (0, auth_1.requireAuth)([auth_1.Roles.ADMIN]), userController.getAdminStrategyTradeSchedule.bind(userController));
        this.userRoutes.put("/admin/strategy-trade-schedule", (0, auth_1.requireAuth)([auth_1.Roles.ADMIN]), userController.updateAdminStrategyTradeSchedule.bind(userController));
    }
    getRouter() {
        return this.userRoutes;
    }
}
exports.UserRouter = UserRouter;
