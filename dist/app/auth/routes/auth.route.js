"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRouter = void 0;
const express_1 = require("express");
const auth_controller_1 = __importDefault(require("../controllers/auth.controller"));
class AuthRouter {
    constructor() {
        this.authRoutes = (0, express_1.Router)();
        this.init();
    }
    init() {
        this.authRoutes.post("/login", (req, res) => auth_controller_1.default.login(req, res));
        this.authRoutes.post("/refresh", (req, res) => auth_controller_1.default.refresh(req, res));
        this.authRoutes.post("/google", (req, res) => auth_controller_1.default.google(req, res));
        this.authRoutes.post("/revoke", (req, res) => auth_controller_1.default.revoke(req, res));
    }
    getRouter() {
        return this.authRoutes;
    }
}
exports.AuthRouter = AuthRouter;
exports.default = AuthRouter;
