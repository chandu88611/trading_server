import { Router } from "express";
import { ForexTraderUserDetailsController } from "../controllers/forexTraderUserDetails.controller";
import { requireAuth, Roles } from "../../../middleware/auth";

export class ForexTraderUserDetailsRouter {
  private router = Router();
  private controller = new ForexTraderUserDetailsController();

  constructor() {
    this.router.put(
      "/me",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.upsertMyDetails.bind(this.controller)
    );
    this.router.get(
      "/me",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.getMyDetails.bind(this.controller)
    );

    this.router.patch(
      "/:id",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.updateMyDetailById.bind(this.controller)
    );
    this.router.delete(
      "/:id",
      requireAuth([Roles.USER, Roles.ADMIN]),
      this.controller.deleteMyDetailById.bind(this.controller)
    );
  }

  getRouter() {
    return this.router;
  }
}
