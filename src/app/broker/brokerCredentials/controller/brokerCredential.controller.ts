import { Request, Response } from "express";
import { BrokerCredentialService } from "../services/brokerCredential.service";
import { ControllerError } from "../../../../types/error-handler";
import { AuthRequest } from "../../../../middleware/auth";

export class BrokerCredentialController {
  private service = new BrokerCredentialService();

  @ControllerError()
  async create(req: AuthRequest, res: Response) {
    let payload = req.body;
    if(payload === null || payload === undefined){
      payload = {};
    }
    let userId = req.auth!.userId;
    payload.userId = userId;
    const created = await this.service.create(payload);
    res.status(201).json({ message: "created", data: created });
  }

  @ControllerError()
  async listByUser(req: Request, res: Response) {
    const userId = Number(req.params.userId) || (req as any).auth?.id;
    const data = await this.service.listByUser(userId);
    res.json({ message: "ok", data });
  }

  @ControllerError()
  async get(req: Request, res: Response) {
    const id = Number(req.params.id);
    const data = await this.service.get(id);
    res.json({ message: "ok", data });
  }

  @ControllerError()
  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    const payload = req.body;
    const data = await this.service.update(id, payload);
    res.json({ message: "updated", data });
  }

  @ControllerError()
  async remove(req: Request, res: Response) {
    const id = Number(req.params.id);
    await this.service.delete(id);
    res.json({ message: "deleted" });
  }
}
