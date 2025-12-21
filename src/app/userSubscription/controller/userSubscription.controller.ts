import { Request, Response } from "express";
import { ControllerError } from "../../../types/error-handler";
import { UserSubscriptionService } from "../services/userSubscription";

export class UserSubscriptionController {
  private service: UserSubscriptionService;

  constructor() {
    this.service = new UserSubscriptionService();
  }

  @ControllerError()
  async subscribe(req: Request, res: Response) {
    const userId = (req as any).auth.userId;
    const payload = req.body;

    const subscription = await this.service.subscribe(userId, payload);

    res.status(201).json({
      message: "Subscription activated",
      data: subscription,
    });
  }

  @ControllerError()
  async cancel(req: Request, res: Response) {
    const userId = (req as any).auth.userId;
    const payload = req.body;

    await this.service.cancel(userId, payload);

    res.status(200).json({
      message: "Subscription has been canceled successfully",
    });
  }

  @ControllerError()
  async current(req: Request, res: Response) {
    const userId = (req as any).auth.userId;

    const subscription = await this.service.getCurrentSubscription(userId);

    res.status(200).json({
      message: "Fetched current subscription",
      data: subscription,
    });
  }

  @ControllerError()
  async getUserSubscriptions(req: Request, res: Response) {
    const userId = Number(req.params.userId);

    const subs = await this.service.getUserSubscriptions(userId);

    res.status(200).json({
      message: "Fetched user subscription history",
      data: subs,
    });
  }

  @ControllerError()
  async adminGetAll(req: Request, res: Response) {
    const offset = Number(req.query.offset || 0);
    const limit = Number(req.query.limit || 20);

    const data = await this.service.getAllSubscriptions(offset, limit);

    res.status(200).json({
      message: "Fetched all subscriptions",
      data,
    });
  }
}
