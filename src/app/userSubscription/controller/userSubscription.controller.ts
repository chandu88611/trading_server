import { UserSubscriptionDBService } from "../services/userSubscription.db";
import { Response } from "express";
import { ControllerError } from "../../../types/error-handler";
import { UserSubscriptionService } from "../services/userSubscription";
import { CrmLifecycleSyncService } from "../../integrations/crm/services/crmLifecycleSync.service";
import { AuthRequest, Roles } from "../../../middleware/auth";
import { HttpStatusCode } from "../../../types/constants";
import AppDataSource from "../../../db/data-source";
import { UserSubscription } from "../../../entity/UserSubscription";

export class UserSubscriptionController {
  private service: UserSubscriptionService;
  private crmSyncService: CrmLifecycleSyncService;

  constructor() {
    this.service = new UserSubscriptionService();
    this.crmSyncService = new CrmLifecycleSyncService();
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

  private ensureNonAdmin(req: AuthRequest) {
    const roles = req.auth?.roles ?? [];
    if (roles.includes(Roles.ADMIN)) {
      throw {
        statusCode: HttpStatusCode._BAD_REQUEST,
        message: "admin_subscriptions_not_allowed",
      };
    }
  }

  @ControllerError()
  async adminMutation(req: AuthRequest, res: Response) {
    this.ensureAdmin(req);
    const action = req.path.endsWith("/status") ? "status" : req.path.endsWith("/execution") ? "execution" : "token";
    const data = await new UserSubscriptionDBService().adminMutate(Number(req.params.id), action, req.body ?? {});
    res.json({ message: "subscription_updated", data });
  }

  @ControllerError()
  async activateDevSandbox(req: AuthRequest, res: Response) {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_SANDBOX_BILLING !== "true") {
      res.status(403).json({ message: "sandbox_billing_disabled" });
      return;
    }
    const { planId, durationDays = 30 } = req.body ?? {};
    if (!Number.isSafeInteger(planId) || planId <= 0 || !Number.isSafeInteger(durationDays) || durationDays < 1 || durationDays > 36500) {
      res.status(400).json({ message: "valid_plan_and_duration_required" });
      return;
    }
    const data = await new UserSubscriptionDBService().activateDevSandbox(Number(req.auth!.userId), planId, durationDays);
    res.status(200).json({ message: "Sandbox subscription activated", data });
  }

  @ControllerError()
  async subscribe(req: AuthRequest, res: Response) {
    this.ensureNonAdmin(req);
    const userId = Number(req.auth!.userId);
    const payload = req.body;

    const subscription = await this.service.subscribe(userId, payload);
    void this.crmSyncService.dispatchSubscriptionEvent({
      eventType: "subscription.activated",
      userId,
      subscriptionId: Number((subscription as any).id),
    });

    res.status(201).json({
      message: "Subscription activated",
      data: subscription,
    });
  }

  @ControllerError()
  async cancel(req: AuthRequest, res: Response) {
    this.ensureNonAdmin(req);
    const userId = Number(req.auth!.userId);
    const payload = req.body;

    await this.service.cancel(userId, payload);
    void this.crmSyncService.dispatchSubscriptionEvent({
      eventType: "subscription.canceled",
      userId,
    });

    res.status(200).json({
      message: "Subscription has been canceled successfully",
    });
  }

  @ControllerError()
  async current(req: AuthRequest, res: Response) {
    this.ensureNonAdmin(req);
    const userId = Number(req.auth!.userId);
    const start = Number(req.query.start || 0);
    const count = Number(req.query.count || 20);
    let searchParams: any = req.query.searchParams;
    if (typeof searchParams === "string") {
      try {
        searchParams = JSON.parse(searchParams);
      } catch (_error) {
        searchParams = {};
      }
    }
    searchParams = {
      ...(searchParams && typeof searchParams === "object" ? searchParams : {}),
      ...(req.query.market ? { market: String(req.query.market) } : {}),
    };

    const subscription = await this.service.getCurrentSubscription(userId, start, count, searchParams);

    res.status(200).json({
      message: "Fetched current subscription",
      data: subscription,
      subscription,
    });
  }

  @ControllerError()
  async followerUserTradingAccount(req: AuthRequest, res: Response) {
    this.ensureNonAdmin(req);
    const userId = Number(req.auth!.userId);
    const start = Number(req.query.start || 0);
    const count = Number(req.query.count || 20);
    const searchParams = req.query.searchParams;

    const followers = await this.service.getFollowerUserTradingAccount(
      userId,
      start,
      count,
      searchParams
    );

    res.status(200).json({
      message: "Fetched follower user trading account",
      followers,
    });
  }

  @ControllerError()
  async getUserSubscriptions(req: AuthRequest, res: Response) {
    this.ensureAdmin(req);
    const userId = Number(req.params.userId);

    const subs = await this.service.getUserSubscriptions(userId);

    res.status(200).json({
      message: "Fetched user subscription history",
      data: subs,
    });
  }

  @ControllerError()
  async adminGetAll(req: AuthRequest, res: Response) {
    this.ensureAdmin(req);
    const offset = Number(req.query.offset || 0);
    const limit = Number(req.query.limit || 20);

    const data = await this.service.getAllSubscriptions(offset, limit);

    res.status(200).json({
      message: "Fetched all subscriptions",
      data,
    });
  }

  @ControllerError()
  async updateWebhookStatus(req: AuthRequest, res: Response) {
    this.ensureAdmin(req);
    const { subscriptionId, isWebhookEnabled } = req.body;

    if (subscriptionId === undefined || isWebhookEnabled === undefined) {
      res.status(400).json({ message: "subscriptionId and isWebhookEnabled are required" });
      return;
    }

    await this.service.updateSubscriptionWebhookStatus(subscriptionId, isWebhookEnabled);

    res.status(200).json({
      message: "Subscription webhook status updated successfully",
    });
  }

  @ControllerError()
  async saveWebhookSettings(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const body = req.body ?? {};
    const data = await this.service.saveWebhookSettings(userId, {
      subscriptionId:
        body.subscriptionId === undefined || body.subscriptionId === null || body.subscriptionId === ""
          ? null
          : Number(body.subscriptionId),
      planId:
        body.planId === undefined || body.planId === null || body.planId === ""
          ? null
          : Number(body.planId),
      isWebhookEnabled: Boolean(body.isWebhookEnabled),
      defaultTradingAccountId:
        body.defaultTradingAccountId === undefined ||
        body.defaultTradingAccountId === null ||
        body.defaultTradingAccountId === ""
          ? null
          : Number(body.defaultTradingAccountId),
      payloadDefaults:
        body.payloadDefaults && typeof body.payloadDefaults === "object"
          ? body.payloadDefaults
          : {},
    });

    res.json({ message: "webhook_settings_saved", data });
  }

  @ControllerError()
  async saveStrategySelections(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const body = req.body ?? {};
    const planIds = Object.keys(body.strategySelections ?? {});
    const planId = Number(body.planId ?? (planIds.length === 1 ? planIds[0] : 0));
    const subscriptionId = Number(body.subscriptionId ?? 0);
    if ((!Number.isSafeInteger(planId) || planId <= 0) && (!Number.isSafeInteger(subscriptionId) || subscriptionId <= 0)) {
      return res.status(400).json({ message: "subscription_or_plan_id_required" });
    }
    const data = await AppDataSource.transaction(async manager => {
      const repo = manager.getRepository(UserSubscription);
      const sub = await repo.findOne({ where: { userId, ...(subscriptionId ? { id: subscriptionId } : { planId }) } as any, order: { updatedAt: "DESC" }, lock: { mode: "pessimistic_write" } });
      if (!sub || sub.statusV2 !== "active" || (sub.endDate && sub.endDate <= new Date())) throw { statusCode: 404, message: "active_subscription_not_found" };
      const key = String(sub.planId);
      const metadata = { ...(sub.metadata ?? {}) };
      if (body.strategySelections !== undefined) {
        const selected = body.strategySelections?.[key];
        if (!Array.isArray(selected) || selected.some((id: any) => !/^\d+$/.test(String(id)))) throw { statusCode: 400, message: "invalid_strategy_selections" };
        const available = await manager.query(`SELECT strategy_id FROM plan_strategies WHERE plan_id=$1`, [sub.planId]);
        if (selected.some((id: any) => !available.some((row: any) => String(row.strategy_id) === String(id)))) throw { statusCode: 400, message: "strategy_not_in_plan" };
        metadata.strategySelections = { ...(metadata.strategySelections ?? {}), [key]: [...new Set(selected.map(String))] };
      }
      if (body.planSignals !== undefined) {
        const settings = body.planSignals?.[key];
        if (!settings || typeof settings !== "object" || Array.isArray(settings)) throw { statusCode: 400, message: "invalid_plan_settings" };
        if (settings.tvIndianProduct && !["MIS", "CNC", "NRML", "INTRADAY", "DELIVERY", "MARGIN"].includes(settings.tvIndianProduct)) throw { statusCode: 400, message: "invalid_indian_product" };
        metadata.planSignals = { ...(metadata.planSignals ?? {}), [key]: settings };
      }
      sub.metadata = metadata;
      return repo.save(sub);
    });
    return res.json({ data });
  }
}
