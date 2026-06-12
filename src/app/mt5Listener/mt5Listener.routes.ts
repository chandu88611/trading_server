// routes/mt5Listener.router.ts
import { Router, Request, Response, NextFunction } from "express";
import { Mt5ListenerDBServices } from "./mt5Listener.db";
import { Mt5ListenerServices } from "./mt5Listener.services";
import { Mt5ListenerController } from "./mt5Listener.controller";
import { AppDataSource as db } from "../../db/data-source";
import { requireAuth, Roles, AuthRequest } from "../../middleware/auth";

export class Mt5ListenerRouter {
  private router: Router;

  constructor() {
    this.router = Router();

    const dbService = new Mt5ListenerDBServices(db);
    const service = new Mt5ListenerServices(dbService);
    const controller = new Mt5ListenerController(service);

    // X-Poll-Key guard: every EA request must carry a per-account secret.
    // The secret is stored in user_trading_accounts.mt5_poll_key and generated
    // when the trading account is created (or via the admin panel).
    const validatePollKey = async (req: Request, res: Response, next: NextFunction) => {
      const brokerAccountId = String(
        req.query.userId ?? req.query.brokerAccountId ?? ""
      ).trim();
      const pollKey = String(req.headers["x-poll-key"] ?? "").trim();

      if (!brokerAccountId || !pollKey) {
        return res.status(401).json({ error: "unauthorized" });
      }

      try {
        const valid = await dbService.findAccountByPollKey(brokerAccountId, pollKey);
        if (!valid) {
          return res.status(401).json({ error: "unauthorized" });
        }
      } catch {
        return res.status(401).json({ error: "unauthorized" });
      }

      return next();
    };

    this.router.get("/", validatePollKey, controller.listenSignal.bind(controller));
    this.router.post("/ack", validatePollKey, controller.ackListenSignal.bind(controller));
    this.router.post("/state", validatePollKey, controller.stateListenSignal.bind(controller));

    // Authenticated (user JWT): read stored MT5 funds for one of the user's accounts.
    this.router.get(
      "/funds",
      requireAuth([Roles.USER, Roles.ADMIN]),
      async (req: AuthRequest, res: Response) => {
        try {
          const userId = Number(req.auth?.userId);
          const tradingAccountId = Number(req.query.tradingAccountId);
          if (!userId || !tradingAccountId) {
            return res.status(400).json({ message: "tradingAccountId_required" });
          }
          const data = await service.getFunds(userId, tradingAccountId);
          return res.json({ data });
        } catch (err: any) {
          return res.status(Number(err?.statusCode ?? 500)).json({ message: err?.message ?? "mt5_funds_failed" });
        }
      },
    );
  }

  getRouter() {
    return this.router;
  }
}
