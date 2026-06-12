import { Request, Response } from "express";
import { AuthRequest } from "../../../middleware/auth";
import { ControllerError } from "../../../types/error-handler";
import { SupportTicketService } from "../services/supportTicket.service";

function validateIntegrationSecret(req: Request) {
  const expectedSecret = String(
    process.env.TRADING_INTEGRATION_SECRET ||
      process.env.CRM_INTEGRATION_SECRET ||
      process.env.CRM_CONVERSION_SECRET ||
      process.env.CRM_API_SECRET ||
      "my_secret"
  ).trim();

  const provided = String(req.headers["x-api-secret"] || "").trim();
  if (!provided || provided !== expectedSecret) {
    throw Object.assign(new Error("invalid_integration_secret"), {
      statusCode: 403,
    });
  }
}

export class SupportTicketController {
  private service = new SupportTicketService();

  @ControllerError()
  async createMyTicket(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const result = await this.service.createMyTicket(userId, req.body ?? {});
    res.status(201).json(result);
  }

  @ControllerError()
  async listMyTickets(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const tickets = await this.service.listMyTickets(userId, req.query ?? {});
    res.json({ tickets });
  }

  @ControllerError()
  async getMyTicketById(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const ticketId = Number(req.params.id);
    if (!Number.isFinite(ticketId) || ticketId <= 0) {
      res.status(400).json({ message: "invalid_ticket_id" });
      return;
    }
    const result = await this.service.getMyTicketById(userId, ticketId);
    res.json(result);
  }

  @ControllerError()
  async addMyMessage(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const ticketId = Number(req.params.id);
    if (!Number.isFinite(ticketId) || ticketId <= 0) {
      res.status(400).json({ message: "invalid_ticket_id" });
      return;
    }
    const result = await this.service.addMyMessage(userId, ticketId, req.body ?? {});
    res.status(201).json(result);
  }

  @ControllerError()
  async upsertFromCrm(req: Request, res: Response) {
    validateIntegrationSecret(req);
    const ticket = await this.service.upsertFromCrm(req.body ?? {});
    res.status(201).json({ ticket });
  }

  @ControllerError()
  async ingestPublicReplyFromCrm(req: Request, res: Response) {
    validateIntegrationSecret(req);
    const message = await this.service.ingestPublicReplyFromCrm(
      req.params.crmTicketId,
      req.body ?? {}
    );
    res.status(201).json({ message });
  }
}
