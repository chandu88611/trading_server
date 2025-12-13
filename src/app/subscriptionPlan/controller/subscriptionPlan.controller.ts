// src/app/subscriptionPlan/controller/subscriptionPlan.controller.ts
import { ControllerError } from "../../../types/error-handler";
import { SubscriptionPlanService } from "../services/subscriptionPlan";
import { Request, Response } from "express";
import { ICreateSubscriptionPlan, IQueryPlans, IUpdateSubscriptionPlan } from "../interfaces/subscriberPlan.interface";

export class SubscriptionPlanController {
  private service: SubscriptionPlanService;

  constructor() {
    this.service = new SubscriptionPlanService();
  }

  @ControllerError()
  async createPlan(req: Request, res: Response) {
    const payload = req.body as ICreateSubscriptionPlan;
    const plan = await this.service.createPlan(payload);

    res.status(201).json({ message: "Subscription plan created", data: plan });
  }

  @ControllerError()
  async getPlan(req: Request, res: Response) {
    const id = Number(req.params.planId);
    const plan = await this.service.getPlan(id);

    res.status(200).json({ message: "Fetched", data: plan });
  }

  @ControllerError()
  async updatePlan(req: Request, res: Response) {
    const id = Number(req.params.planId);
    const payload = req.body as IUpdateSubscriptionPlan;

    await this.service.updatePlan(id, payload);
    res.status(200).json({ message: "Updated successfully" });
  }

  @ControllerError()
  async deletePlan(req: Request, res: Response) {
    const id = Number(req.params.planId);
    await this.service.deletePlan(id);

    res.status(200).json({ message: "Plan deactivated" });
  }

  @ControllerError()
  async getAll(req: Request, res: Response) {
    const query = req.query as any as IQueryPlans;

    // querystring booleans come as string
    if (typeof (query as any).isActive === "string") {
      (query as any).isActive = (query as any).isActive === "true";
    }

    const data = await this.service.getPlans(query);
    res.status(200).json({ message: "Fetched all plans", data });
  }

  @ControllerError()
  async getActive(req: Request, res: Response) {
    const { category, executionFlow } = req.query as any;
    const plans = await this.service.getActivePlans(category, executionFlow);
    res.status(200).json({ message: "Fetched active plans", data: plans });
  }
}
