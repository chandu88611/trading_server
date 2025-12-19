import { Request, Response } from "express";
import { AlertSnapshotService } from "../services/alertSnapshot.service";
import { ControllerError } from "../../../../types/error-handler";
import { AuthRequest } from "../../../../middleware/auth";
import { AlertSnapshot } from "../../../../entity/AlertSnapshots";

export class AlertSnapshotController {
  private service = new AlertSnapshotService();

  @ControllerError()
  async create(req: AuthRequest, res: Response) {
    const payload = req.body;
    const userId = req.auth!.userId;
    const fullPayload = { ...payload, userId };
    const s: AlertSnapshot | undefined = await this.service.create(fullPayload);
    res.status(201).json({ message: "created", data: s });
  }

  @ControllerError()
  async listByJob(req: Request, res: Response) {
    const jobId = Number(req.params.jobId);
    const data = await this.service.listByJob(jobId);
    res.json({ message: "ok", data });
  }
}
