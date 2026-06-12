import { Router } from "express";
import { requireAuth, Roles } from "../../../middleware/auth";
import { SupportTicketController } from "../controllers/supportTicket.controller";

export class SupportTicketRouter {
  private readonly userRoutes: Router;
  private readonly integrationRoutes: Router;
  private readonly controller: SupportTicketController;

  constructor() {
    this.userRoutes = Router();
    this.integrationRoutes = Router();
    this.controller = new SupportTicketController();

    this.userRoutes.post(
      "/tickets",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.createMyTicket.bind(this.controller)
    );
    this.userRoutes.get(
      "/tickets",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.listMyTickets.bind(this.controller)
    );
    this.userRoutes.get(
      "/tickets/:id",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.getMyTicketById.bind(this.controller)
    );
    this.userRoutes.post(
      "/tickets/:id/messages",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.addMyMessage.bind(this.controller)
    );

    this.integrationRoutes.post(
      "/tickets/upsert",
      this.controller.upsertFromCrm.bind(this.controller)
    );
    this.integrationRoutes.post(
      "/tickets/:crmTicketId/public-replies",
      this.controller.ingestPublicReplyFromCrm.bind(this.controller)
    );
  }

  getUserRouter() {
    return this.userRoutes;
  }

  getIntegrationRouter() {
    return this.integrationRoutes;
  }
}
