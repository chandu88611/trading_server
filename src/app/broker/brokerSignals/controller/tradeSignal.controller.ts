import { Request, Response } from "express";
import { TradeSignalService } from "../services/tradeSignal.service";
import { ControllerError } from "../../../../types/error-handler";

export class TradeSignalController {
  private service = new TradeSignalService();

  @ControllerError()
  async create(req: Request, res: Response) {
    const payload = req.body;
    const s = await this.service.create(payload);
    res.status(201).json({ message: "created", data: s });
  }

  @ControllerError()
  async listByJob(req: Request, res: Response) {
    const jobId = Number(req.params.jobId);
    const data = await this.service.listByJob(jobId);
    res.json({ message: "ok", data });
  }
}
