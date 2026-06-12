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

  async saveStrategySelections(req: AuthRequest, res: Response) {
    try {
      const userId = Number(req.auth!.userId);
      const selections = (req.body as any)?.strategySelections;
      if (!selections || typeof selections !== "object") {
        res.status(400).json({ message: "strategySelections_required" });
        return;
      }
      const repo = AppDataSource.getRepository(UserSubscription);
      const sub = await repo.findOne({ where: { userId } as any, order: { updatedAt: "DESC" } as any });
      if (!sub) { res.status(404).json({ message: "subscription_not_found" }); return; }
      sub.metadata = { ...(sub.metadata ?? {}), strategySelections: selections };
      await repo.save(sub);
      res.json({ data: sub });
    } catch (e: any) {
      res.status(500).json({ message: e?.message ?? "error" });
    }
  }
}
