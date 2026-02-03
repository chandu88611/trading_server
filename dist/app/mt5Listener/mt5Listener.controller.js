"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mt5ListenerController = void 0;
class Mt5ListenerController {
    constructor(service) {
        this.service = service;
    }
    async listenSignal(req, res) {
        try {
            const brokerAccountId = String(req.query.userId || "");
            if (!brokerAccountId)
                return res.json({});
            console.log("USER ID ::: ", brokerAccountId);
            const signal = await this.service.getSignalForEA(brokerAccountId);
            if (signal && signal.ackId) {
                signal.ackId = Number(signal.ackId || 0);
                signal.qty =
                    1;
            }
            console.log("Signal to be sent ::: ", signal);
            return res.json(signal);
        }
        catch (err) {
            console.error("listenSignal error:", err);
            return res.json({});
        }
    }
    async ackListenSignal(req, res) {
        try {
            let body = req.body;
            if (typeof body === "object" &&
                Object.keys(body).length === 1) {
                const raw = Object.keys(body)[0];
                body = JSON.parse(raw.replace(/\0/g, ""));
            }
            await this.service.handleAck(body);
            return res.json({ ok: true });
        }
        catch (err) {
            console.error("ack error:", err);
            return res.json({ ok: false });
        }
    }
    async stateListenSignal(_, res) {
        return res.json({ ok: true });
    }
}
exports.Mt5ListenerController = Mt5ListenerController;
