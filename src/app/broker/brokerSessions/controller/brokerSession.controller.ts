import { Request, Response } from "express";
import { BrokerSessionService } from "../services/brokerSession.service";
import { ControllerError } from "../../../../types/error-handler";

export class BrokerSessionController {
  private service = new BrokerSessionService();

  @ControllerError()
  async create(req: Request, res: Response) {
    const payload = req.body;
    const s = await this.service.create(payload);
    res.status(201).json({ message: "created", data: s });
  }

  @ControllerError()
  async listValid(req: Request, res: Response) {
    const credentialId = Number(req.params.credentialId);
    const data = await this.service.getValidSessions(credentialId);
    res.json({ message: "ok", data });
  }

  @ControllerError()
  async revokeAll(req: Request, res: Response) {
    const credentialId = Number(req.params.credentialId);
    await this.service.revokeAll(credentialId);
    res.json({ message: "revoked" });
  }
}
