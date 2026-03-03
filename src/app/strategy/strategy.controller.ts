import { Request, Response } from "express";
import { ControllerError } from "../../types/error-handler";
import { StrategyService } from "./strategy";
import { AuthRequest } from "../../middleware/auth";

export class StrategyController {
  private service = new StrategyService();

  @ControllerError()
  async create(req: Request, res: Response) {
    const s = await this.service.create(req.body);
    res.status(201).json({ message: "Strategy created", data: s });
  }

  @ControllerError()
  async listActive(req: Request, res: Response) {
    const data = await this.service.list({ isActive: true });
    res.status(200).json({ message: "Fetched strategies", data });
  }

  @ControllerError()
  async enableStrategy(req: Request, res: Response) {
    const strategyId = Number(req.params.strategyId);
    const data = await this.service.setStrategyActive(strategyId, true);
    res.status(200).json({ message: "strategy_enabled", data });
  }

  @ControllerError()
  async disableStrategy(req: Request, res: Response) {
    const strategyId = Number(req.params.strategyId);
    const data = await this.service.setStrategyActive(strategyId, false);
    res.status(200).json({ message: "strategy_disabled", data });
  }

  @ControllerError()
  async enableUserStrategyInstance(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const instanceId = Number(req.params.instanceId);
    const data = await this.service.setUserStrategyInstanceStatus(
      userId,
      instanceId,
      "active"
    );
    res.status(200).json({ message: "user_strategy_enabled", data });
  }

  @ControllerError()
  async disableUserStrategyInstance(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const instanceId = Number(req.params.instanceId);
    const data = await this.service.setUserStrategyInstanceStatus(
      userId,
      instanceId,
      "paused"
    );
    res.status(200).json({ message: "user_strategy_disabled", data });
  }
}
