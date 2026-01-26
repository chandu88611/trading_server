import { Request, Response } from "express";
import { ControllerError } from "../../types/error-handler";
import { StrategyService } from "./strategy";

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
}
