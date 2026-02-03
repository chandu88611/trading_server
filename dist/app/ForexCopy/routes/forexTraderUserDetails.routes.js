"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForexTraderUserDetailsRouter = void 0;
const express_1 = require("express");
const forexTraderUserDetails_controller_1 = require("../controllers/forexTraderUserDetails.controller");
const auth_1 = require("../../../middleware/auth");
class ForexTraderUserDetailsRouter {
    constructor() {
        this.router = (0, express_1.Router)();
        this.controller = new forexTraderUserDetails_controller_1.ForexTraderUserDetailsController();
        this.router.put("/me", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.upsertMyDetails.bind(this.controller));
        this.router.get("/me", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.getMyDetails.bind(this.controller));
        this.router.patch("/:id", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.updateMyDetailById.bind(this.controller));
        this.router.delete("/:id", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.deleteMyDetailById.bind(this.controller));
    }
    getRouter() {
        return this.router;
    }
}
exports.ForexTraderUserDetailsRouter = ForexTraderUserDetailsRouter;
