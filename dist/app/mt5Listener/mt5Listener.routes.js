"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mt5ListenerRouter = void 0;
// routes/mt5Listener.router.ts
const express_1 = require("express");
const mt5Listener_db_1 = require("./mt5Listener.db");
const mt5Listener_services_1 = require("./mt5Listener.services");
const mt5Listener_controller_1 = require("./mt5Listener.controller");
const data_source_1 = require("../../db/data-source");
class Mt5ListenerRouter {
    constructor() {
        this.router = (0, express_1.Router)();
        const dbService = new mt5Listener_db_1.Mt5ListenerDBServices(data_source_1.AppDataSource);
        const service = new mt5Listener_services_1.Mt5ListenerServices(dbService);
        const controller = new mt5Listener_controller_1.Mt5ListenerController(service);
        this.router.get("/", controller.listenSignal.bind(controller));
        this.router.post("/ack", controller.ackListenSignal.bind(controller));
        this.router.post("/state", controller.stateListenSignal.bind(controller));
    }
    getRouter() {
        return this.router;
    }
}
exports.Mt5ListenerRouter = Mt5ListenerRouter;
