import { Response } from "express";
import { AlertSnapshotService } from "../services/alertSnapshot.service";
import { ControllerError } from "../../../../types/error-handler";
import { AuthRequest } from "../../../../middleware/auth";
import { PlanWebhookAuthRequest } from "../../../../middleware/planWebhookAuth";

export class AlertSnapshotController {
  private service = new AlertSnapshotService();

  private logIncomingAlert(
    scope: "subscriber" | "admin_strategy",
    context: Record<string, unknown>
  ) {
    console.log(`[ALERT] received ${scope} alert`, context);
  }

  @ControllerError()
  async create(req: AuthRequest, res: Response) {
    const payload = req.body;
    const userId = req.auth!.userId;
    const fullPayload = {
      ...payload,
      userId: Number(userId),
      subscriptionId: req.auth?.subscriptionId
        ? Number(req.auth.subscriptionId)
        : undefined,
      planId: req.auth?.planId,
      tokenType: req.auth?.tokenType,
    };
    this.logIncomingAlert("subscriber", {
      userId: Number(userId),
      subscriptionId: fullPayload.subscriptionId ?? null,
      planId: fullPayload.planId ?? null,
      tokenType: fullPayload.tokenType ?? null,
      market: payload?.market ?? null,
      ticker: payload?.ticker ?? null,
      action: payload?.action ?? null,
      executionMode: payload?.executionMode ?? null,
      entryRef: payload?.entryRef ?? null,
      tradingStrength: payload?.tradingStrength ?? null,
    });
    const s = await this.service.create(fullPayload);
    res.status(201).json({ message: "created", data: s });
  }

  @ControllerError()
  async createStrategy(req: PlanWebhookAuthRequest, res: Response) {
    const payload = req.body;
    const planId = Number(req.planWebhookAuth!.planId);
    this.logIncomingAlert("admin_strategy", {
      planId,
      market: payload?.market ?? null,
      ticker: payload?.ticker ?? null,
      action: payload?.action ?? null,
      executionMode: payload?.executionMode ?? null,
      entryRef: payload?.entryRef ?? null,
      tradingStrength: payload?.tradingStrength ?? null,
    });
    const data = await this.service.createForPlan(planId, payload);
    res.status(201).json({ message: "created", data });
  }

  @ControllerError()
  async getAdminHistory(req: AuthRequest, res: Response) {
    const data = await this.service.getAdminAlertHistory({
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 20),

      userId: req.query.userId ? Number(req.query.userId) : undefined,
      planId: req.query.planId ? Number(req.query.planId) : undefined,

      ticker: (req.query.ticker as string) || undefined,
      exchange: (req.query.exchange as string) || undefined,
      interval: (req.query.interval as string) || undefined,

      from: (req.query.from as string) || undefined,
      to: (req.query.to as string) || undefined,
      lastMinutes: req.query.lastMinutes ? Number(req.query.lastMinutes) : undefined,
    });

    res.status(200).json({ message: "ok", data });
  }

  @ControllerError()
  async getHistory(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);

    const data = await this.service.getAlertHistory(userId, {
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 20),

      ticker: (req.query.ticker as string) || undefined,
      exchange: (req.query.exchange as string) || undefined,
      interval: (req.query.interval as string) || undefined,

      from: (req.query.from as string) || undefined,
      to: (req.query.to as string) || undefined,
      lastMinutes: req.query.lastMinutes
        ? Number(req.query.lastMinutes)
        : undefined,
    });

    res.status(200).json({ message: "ok", data });
  }
}
