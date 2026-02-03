"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrokerLinkRouter = void 0;
// src/app/broker/routes/brokerLink.route.ts
const express_1 = require("express");
const auth_1 = require("../../../../middleware/auth");
const brokerLink_controller_1 = require("../controllers/brokerLink.controller");
class BrokerLinkRouter {
    constructor() {
        this.routes = (0, express_1.Router)({ mergeParams: true });
        this.controller = new brokerLink_controller_1.BrokerLinkController();
        // List all brokers linked to a trading account
        this.routes.get("/:accountId", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.listBrokersForAccount.bind(this.controller));
        // Link a broker to a trading account
        this.routes.post("/:accountId", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.linkBrokerToAccount.bind(this.controller));
        // Unlink a broker from a trading account
        this.routes.delete("/:brokerId", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), this.controller.unlinkBrokerFromAccount.bind(this.controller));
    }
    getRouter() {
        return this.routes;
    }
}
exports.BrokerLinkRouter = BrokerLinkRouter;
