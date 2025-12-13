import { Request, Response } from "express";
import { BrokerEventService } from "../services/brokerEvent.service";
import { ControllerError } from "../../../../types/error-handler";

export class BrokerEventController {
  private service = new BrokerEventService();

  @ControllerError()
  async create(req: Request, res: Response) {
    const payload = req.body;
    const ev = await this.service.create(payload);
    res.status(201).json({ message: "created", data: ev });
  }

  @ControllerError()
  async listByJob(req: Request, res: Response) {
    const jobId = Number(req.params.jobId);
    const data = await this.service.listByJob(jobId);
    res.json({ message: "ok", data });
  }
}
