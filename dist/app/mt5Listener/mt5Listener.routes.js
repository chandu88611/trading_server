"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mt5ListenerRouter = void 0;
// routes/mt5Listener.router.ts
const express_1 = require("express");
const mt5Listener_db_1 = require("./mt5Listener.db");
const mt5Listener_services_1 = require("./mt5Listener.services");
const mt5Listener_controller_1 = require("./mt5Listener.controller");
const data_source_1 = require("../../db/data-source");
const auth_1 = require("../../middleware/auth");
class Mt5ListenerRouter {
    constructor() {
        this.router = (0, express_1.Router)();
        const dbService = new mt5Listener_db_1.Mt5ListenerDBServices(data_source_1.AppDataSource);
        const service = new mt5Listener_services_1.Mt5ListenerServices(dbService);
        const controller = new mt5Listener_controller_1.Mt5ListenerController(service);
        // X-Poll-Key guard: every EA request must carry a per-account secret.
        // The secret is stored in user_trading_accounts.mt5_poll_key and generated
        // when the trading account is created (or via the admin panel).
        const validatePollKey = async (req, res, next) => {
            const brokerAccountId = String(req.query.userId ?? req.query.brokerAccountId ?? "").trim();
            const pollKey = String(req.headers["x-poll-key"] ?? "").trim();
            if (!brokerAccountId || !pollKey) {
                return res.status(401).json({ error: "unauthorized" });
            }
            try {
                const valid = await dbService.findAccountByPollKey(brokerAccountId, pollKey);
                if (!valid) {
                    return res.status(401).json({ error: "unauthorized" });
                }
            }
            catch {
                return res.status(401).json({ error: "unauthorized" });
            }
            return next();
        };
        this.router.get("/", validatePollKey, controller.listenSignal.bind(controller));
        this.router.post("/ack", validatePollKey, controller.ackListenSignal.bind(controller));
        this.router.post("/state", validatePollKey, controller.stateListenSignal.bind(controller));
        // Authenticated (user JWT): read stored MT5 funds for one of the user's accounts.
        this.router.get("/funds", (0, auth_1.requireAuth)([auth_1.Roles.USER, auth_1.Roles.ADMIN]), async (req, res) => {
            try {
                const userId = Number(req.auth?.userId);
                const tradingAccountId = Number(req.query.tradingAccountId);
                if (!userId || !tradingAccountId) {
                    return res.status(400).json({ message: "tradingAccountId_required" });
                }
                const data = await service.getFunds(userId, tradingAccountId);
                return res.json({ data });
            }
            catch (err) {
                return res.status(Number(err?.statusCode ?? 500)).json({ message: err?.message ?? "mt5_funds_failed" });
            }
        });
    }
    getRouter() {
        return this.router;
    }
}
exports.Mt5ListenerRouter = Mt5ListenerRouter;
