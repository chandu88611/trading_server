import { Response } from "express";
import { ControllerError } from "../../../types/error-handler";
import { AuthRequest } from "../../../middleware/auth";
import { ForexTraderUserDetailsService } from "../services/forexTraderUserDetails.service";
import { ForexTradeCategory } from "../../../entity/entity.enum";

export class ForexTraderUserDetailsController {
  private service = new ForexTraderUserDetailsService();

  constructor() {}

  @ControllerError()
  async upsertMyDetails(req: AuthRequest, res: Response): Promise<void> {
    const userId = Number(req.auth!.userId);

    const { forexTraderUserId, forexType, token, isMaster } = req.body ?? {};

    // basic validations like your style
    if (!forexTraderUserId || !forexType ) {
      res.status(400).json({
        message: "forexTraderUserId, forexType and token are required",
      });
      return;
    }

    // ensure forexType is valid enum value
    if (!Object.values(ForexTradeCategory).includes(forexType)) {
      res.status(400).json({ message: "Invalid forexType" });
      return;
    }

  

    if (isMaster !== undefined && typeof isMaster !== "boolean") {
      res.status(400).json({ message: "isMaster must be boolean" });
      return;
    }

    const data = await this.service.upsertMyDetails(userId, {
      forexTraderUserId,
      forexType,
      token,
      isMaster,
    });

    res.status(200).json({ message: "Saved", data });
  }

  @ControllerError()
  async getMyDetails(req: AuthRequest, res: Response): Promise<void> {
    const userId = Number(req.auth!.userId);
    const data = await this.service.getMyDetails(userId);
    res.status(200).json({ message: "ok", data });
  }

  @ControllerError()
  async updateMyDetailById(req: AuthRequest, res: Response): Promise<void> {
    const userId = Number(req.auth!.userId);
    const id = Number(req.params.id);

    if (!id) {
      res.status(400).json({ message: "Invalid id" });
      return;
    }

    const { forexTraderUserId, token, isMaster } = req.body ?? {};

    if (token !== undefined && token !== null && typeof token !== "string") {
      res.status(400).json({ message: "Invalid token" });
      return;
    }

    if (isMaster !== undefined && typeof isMaster !== "boolean") {
      res.status(400).json({ message: "isMaster must be boolean" });
      return;
    }

    const data = await this.service.updateMyDetailById(userId, id, {
      forexTraderUserId,
      token,
      isMaster,
    });

    res.status(200).json({ message: "Updated", data });
  }

  @ControllerError()
  async deleteMyDetailById(req: AuthRequest, res: Response): Promise<void> {
    const userId = Number(req.auth!.userId);
    const id = Number(req.params.id);

    if (!id) {
      res.status(400).json({ message: "Invalid id" });
      return;
    }

    const result = await this.service.deleteMyDetailById(userId, id);
    res.status(200).json({ message: "Deleted", data: result });
  }
}
