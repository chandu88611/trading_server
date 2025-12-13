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
        this.userRoutes.post("/register", rateLimit_1.createRateLimiter, validate_1.validateRegister, userController.registerUser.bind(userController));
        this.userRoutes.get("/me", (0, auth_1.requireAuth)([auth_1.Roles.USER]), (req, res) => res.json({ message: "ok", user: req.auth }));
    }
    getRouter() {
        return this.userRoutes;
    }
}
exports.UserRouter = UserRouter;
