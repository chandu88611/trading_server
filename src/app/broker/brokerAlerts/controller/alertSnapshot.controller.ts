import { Request, Response } from "express";
import { AlertSnapshotService } from "../services/alertSnapshot.service";
import { ControllerError } from "../../../../types/error-handler";
import { AuthRequest } from "../../../../middleware/auth";
import { AlertSnapshot } from "../../../../entity/AlertSnapshots";
import { parseTimelineBucket, TimelineQuery } from "../interfaces/alertSnapshot.interface";

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
  async getHistory(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);

    const data = await this.service.getAlertHistory(userId, {
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 20),

      ticker: (req.query.ticker as string) || undefined,
      exchange: (req.query.exchange as string) || undefined,
      interval: (req.query.interval as string) || undefined,
      jobId: req.query.jobId ? Number(req.query.jobId) : undefined,

      from: (req.query.from as string) || undefined,
      to: (req.query.to as string) || undefined,
      lastMinutes: req.query.lastMinutes
        ? Number(req.query.lastMinutes)
        : undefined,
    });

    res.status(200).json({ message: "ok", data });
  }

  @ControllerError()
  async getTimeline(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);

    const data = await this.service.getAlertTimeline(userId, {
      bucket: parseTimelineBucket(req.query.bucket),

      ticker: (req.query.ticker as string) || undefined,
      exchange: (req.query.exchange as string) || undefined,
      interval: (req.query.interval as string) || undefined,
      jobId: req.query.jobId ? Number(req.query.jobId) : undefined,

      from: (req.query.from as string) || undefined,
      to: (req.query.to as string) || undefined,
      lastMinutes: req.query.lastMinutes ? Number(req.query.lastMinutes) : undefined,
    });

    res.status(200).json({ message: "ok", data });
  }

  @ControllerError()
  async listByJob(req: Request, res: Response) {
    const jobId = Number(req.params.jobId);
    const data = await this.service.listByJob(jobId);
    res.json({ message: "ok", data });
  }
}
