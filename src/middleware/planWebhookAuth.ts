import { Request, Response, NextFunction } from "express";
import AppDataSource from "../db/data-source";
import { PlanAdminWebhookToken } from "../entity/PlanAdminWebhookToken";

export interface PlanWebhookAuthRequest extends Request {
  planWebhookAuth?: {
    planId: number;
    token: string;
  };
}

function resolveToken(req: Request): string {
  const headerToken = String(req.headers["x-webhook-token"] ?? "").trim();
  if (headerToken) return headerToken;

  const authHeader = String(req.headers.authorization ?? "").trim();
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  const queryToken = String(req.query.token ?? "").trim();
  if (queryToken) return queryToken;

  const bodyToken = String((req.body as any)?.token ?? "").trim();
  if (bodyToken) return bodyToken;

  const webhookToken = String((req.body as any)?.webhook_token ?? "").trim();
  if (webhookToken) return webhookToken;

  return "";
}

export function requirePlanWebhookAuth() {
  return async (
    req: PlanWebhookAuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    const token = resolveToken(req);
    if (!token) {
      return res.status(401).json({ message: "Plan webhook token missing" });
    }

    try {
      const tokenRepo = AppDataSource.getRepository(PlanAdminWebhookToken);
      const tokenRow = await tokenRepo
        .createQueryBuilder("planWebhook")
        .leftJoinAndSelect("planWebhook.plan", "plan")
        .where("planWebhook.token = :token", { token })
        .andWhere("plan.is_active = true")
        .getOne();

      const plan = tokenRow?.plan ?? null;

      if (!plan) {
        return res.status(401).json({ message: "Invalid or inactive plan webhook token" });
      }

      req.planWebhookAuth = {
        planId: Number(plan.id),
        token,
      };

      return next();
    } catch (error) {
      return res.status(500).json({ message: "Plan webhook authentication failed" });
    }
  };
}
