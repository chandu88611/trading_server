import { Request, Response } from "express";
import { BrokerJobService } from "../services/brokerJob.service";
import { ControllerError } from "../../../../types/error-handler";

export class BrokerJobController {
  private service = new BrokerJobService();

  @ControllerError()
  async create(req: Request, res: Response) {
    const payload = req.body;
    const job = await this.service.create(payload);
    res.status(201).json({ message: "created", data: job });
  }

  @ControllerError()
  async get(req: Request, res: Response) {
    const id = Number(req.params.id);
    const job = await this.service.getById(id);
    res.json({ message: "ok", data: job });
  }

  @ControllerError()
  async listByCredential(req: Request, res: Response) {
    const credentialId = Number(req.params.credentialId);
    const jobs = await this.service.listByCredential(credentialId);
    res.json({ message: "ok", data: jobs });
  }

  @ControllerError()
  async listPending(req: Request, res: Response) {
    const limit = Number(req.query.limit) || 50;
    const jobs = await this.service.listPending(limit);
    res.json({ message: "ok", data: jobs });
  }

  @ControllerError()
  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    const payload = req.body;
    const job = await this.service.update(id, payload);
    res.json({ message: "updated", data: job });
  }
}
