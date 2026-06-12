// src/app/subscriptionPlan/controller/subscriptionPlan.controller.ts
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest, getJwtSecret, Roles } from "../../../middleware/auth";
import { ControllerError } from "../../../types/error-handler";
import { SubscriptionPlanService } from "../services/subscriptionPlan";
import {
  ICreateSubscriptionPlan,
  IQueryPlans,
  IUpdateSubscriptionPlan,
} from "../interfaces/subscriberPlan.interface";
import { HttpStatusCode } from "../../../types/constants";

function resolveOptionalUserId(req: Request): number | null {
  try {
    let token: string | null = null;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice("Bearer ".length).trim();
    }

    if (!token) {
      token = (req as any).cookies?.access_token || null;
    }

    if (!token) return null;

    const payload = jwt.verify(token, getJwtSecret()) as any;
    if (payload?.type !== "access") return null;

    const userId = Number(payload?.userId);
    return Number.isFinite(userId) && userId > 0 ? userId : null;
  } catch {
    return null;
  }
}

export class SubscriptionPlanController {
  private service: SubscriptionPlanService;

  constructor() {
    this.service = new SubscriptionPlanService();
  }

  private ensureAdmin(req: AuthRequest) {
    const roles = req.auth?.roles ?? [];
    if (!roles.includes(Roles.ADMIN)) {
      throw {
        statusCode: HttpStatusCode._UNAUTHORISED,
        message: "Admin access required",
      };
    }
  }

  private resolveWebhookOrigin(req: Request): string {
    const configuredBaseUrl = String(
      process.env.WEBHOOK_PUBLIC_BASE_URL ||
        process.env.PUBLIC_API_BASE_URL ||
        process.env.APP_BASE_URL ||
        ""
    ).trim();

    if (configuredBaseUrl) {
      try {
        return new URL(configuredBaseUrl).origin;
      } catch {}
    }

    const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "")
      .split(",")[0]
      .trim();
    const forwardedHost = String(req.headers["x-forwarded-host"] ?? "")
      .split(",")[0]
      .trim();
    const host = forwardedHost || String(req.headers.host ?? "").trim();
    const protocol = forwardedProto || req.protocol || "http";

    return host ? `${protocol}://${host}` : "";
  }

  private buildStrategyWebhookUrl(req: Request, token: string): string {
    const origin = this.resolveWebhookOrigin(req);
    const path = `/tradingview/alerts/strategy?token=${encodeURIComponent(token)}`;
    return origin ? `${origin}${path}` : path;
  }

  @ControllerError()
  async createPlan(req: AuthRequest, res: Response) {
    this.ensureAdmin(req);
    const payload = req.body as ICreateSubscriptionPlan;
    const plan = await this.service.createPlan(payload);
    res.status(201).json({ message: "Subscription plan created", data: plan });
  }

  @ControllerError()
  async getPlan(req: Request, res: Response) {
    const id = Number(req.params.planId); // BIGINT
    const plan = await this.service.getPlan(id);
    res.status(200).json({ message: "Fetched", data: plan });
  }

  @ControllerError()
  async updatePlan(req: AuthRequest, res: Response) {
    this.ensureAdmin(req);
    const id = Number(req.params.planId); // BIGINT
    const payload = req.body as IUpdateSubscriptionPlan;
    await this.service.updatePlan(id, payload);
    res.status(200).json({ message: "Updated successfully" });
  }

  @ControllerError()
  async deletePlan(req: AuthRequest, res: Response) {
    this.ensureAdmin(req);
    const id = Number(req.params.planId); // BIGINT
    await this.service.deactivatePlan(id);
    res.status(200).json({ message: "Plan deactivated" });
  }

  @ControllerError()
  async getAll(req: Request, res: Response) {
    const query = req.query as any as IQueryPlans;
    const viewerUserId = resolveOptionalUserId(req);

    if (typeof (query as any).isActive === "string") {
      (query as any).isActive = (query as any).isActive === "true";
    }

    const result = await this.service.getPlans(query, viewerUserId);
    res.status(200).json({
      message: "Fetched all plans",
      data: [result.rows, result.total],
      subscriberHasAnyActivePlan: result.subscriberHasAnyActivePlan,
      subscriberActivePlanIds: result.subscriberActivePlanIds,
    });
  }

  @ControllerError()
  async getActive(req: Request, res: Response) {
    const query = req.query as any as IQueryPlans;
    const viewerUserId = resolveOptionalUserId(req);
    (query as any).isActive = true;
    const result = await this.service.getPlans(query, viewerUserId);
    res.status(200).json({
      message: "Fetched active plans",
      data: [result.rows, result.total],
      subscriberHasAnyActivePlan: result.subscriberHasAnyActivePlan,
      subscriberActivePlanIds: result.subscriberActivePlanIds,
    });
  }

  @ControllerError()
  async getAdminWebhookToken(req: AuthRequest, res: Response) {
    this.ensureAdmin(req);
    const planId = Number(req.params.planId);
    const token = await this.service.getAdminWebhookToken(planId);

    res.status(200).json({
      message: "Fetched admin webhook token",
      data: {
        planId,
        adminWebhookToken: token,
        url: this.buildStrategyWebhookUrl(req, token),
      },
    });
  }

  @ControllerError()
  async rotateAdminWebhookToken(req: AuthRequest, res: Response) {
    this.ensureAdmin(req);
    const planId = Number(req.params.planId);
    const token = await this.service.rotateAdminWebhookToken(planId);

    res.status(200).json({
      message: "Rotated admin webhook token",
      data: {
        planId,
        adminWebhookToken: token,
        url: this.buildStrategyWebhookUrl(req, token),
      },
    });
  }
}
