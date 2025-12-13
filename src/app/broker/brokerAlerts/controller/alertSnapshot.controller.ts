import { Request, Response } from "express";
import { AlertSnapshotService } from "../services/alertSnapshot.service";
import { ControllerError } from "../../../../types/error-handler";

export class AlertSnapshotController {
  private service = new AlertSnapshotService();

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
