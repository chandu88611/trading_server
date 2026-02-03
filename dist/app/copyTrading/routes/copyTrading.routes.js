"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopyTradingRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../../../middleware/auth");
const copyTrading_controller_1 = require("../controller/copyTrading.controller");
class CopyTradingRouter {
    constructor() {
        this.router = (0, express_1.Router)();
        this.init();
    }
    init() {
        const controller = new copyTrading_controller_1.CopyTradingController();
        this.router.get("/master/me", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), controller.getMyMaster.bind(controller));
        this.router.post("/master", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), controller.upsertMyMaster.bind(controller));
        this.router.get("/masters", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), controller.listMasters.bind(controller));
        this.router.post("/follow", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), controller.followMaster.bind(controller));
        this.router.get("/follows/me", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), controller.listMyFollows.bind(controller));
        this.router.patch("/follows/:followId", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), controller.updateMyFollow.bind(controller));
        this.router.get("/followers/me", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), controller.listMyFollowers.bind(controller));
        this.router.patch("/followers/:followId/decision", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), controller.decideFollowerRequest.bind(controller));
    }
    getRouter() {
        return this.router;
    }
}
exports.CopyTradingRouter = CopyTradingRouter;
