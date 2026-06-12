import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { ControllerError } from "../../types/error-handler";
import { HttpStatusCode } from "../../types/constants";
import { CopyExecutionService } from "./copyExecution.service";

function parseUserId(req: AuthRequest) {
  const userId = Number(req.auth?.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw { statusCode: HttpStatusCode._UNAUTHORISED, message: "user_not_authorized" };
  }
  return userId;
}

function parseMode(value: unknown) {
  const mode = String(value ?? "").trim().toUpperCase();
  if (mode === "INDIAN") return "INDIA";
  if (mode === "INDIA" || mode === "FOREX") return mode;
  throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "invalid_mode" };
}

export class CopyExecutionController {
  private service = new CopyExecutionService();

  @ControllerError()
  async listStrategies(req: AuthRequest, res: Response) {
    const userId = parseUserId(req);
    const mode = parseMode(req.query.mode);
    const data = await this.service.listStrategies(userId, mode);
    res.json({ message: "copy_strategies", data });
  }

  @ControllerError()
  async listLinks(req: AuthRequest, res: Response) {
    const userId = parseUserId(req);
    const mode = parseMode(req.query.mode);
    const data = await this.service.listLinks(userId, mode);
    res.json({ message: "copy_links", data });
  }

  @ControllerError()
  async searchSymbols(req: AuthRequest, res: Response) {
    const userId = parseUserId(req);
    const mode = parseMode(req.query.mode);
    const data = await this.service.searchSymbols(userId, mode, req.query.q);
    res.json({ message: "copy_symbols", data });
  }

  @ControllerError()
  async upsertLink(req: AuthRequest, res: Response) {
    const userId = parseUserId(req);
    const data = await this.service.upsertLink(userId, req.body ?? {});
    res.status(201).json({ message: "copy_link_saved", data });
  }

  @ControllerError()
  async deleteLink(req: AuthRequest, res: Response) {
    const userId = parseUserId(req);
    const mode = parseMode(req.query.mode);
    const strategyId = String(req.params.strategyId ?? "").trim();
    if (!strategyId) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "strategyId_required" };
    }
    const data = await this.service.deleteLink(userId, mode, strategyId);
    res.json({ message: "copy_link_deleted", data });
  }

  @ControllerError()
  async manualTrade(req: AuthRequest, res: Response) {
    const userId = parseUserId(req);
    const data = await this.service.placeManualTrade(userId, req.body ?? {});
    res.status(202).json({ message: "manual_trade_queued", data });
  }
}
