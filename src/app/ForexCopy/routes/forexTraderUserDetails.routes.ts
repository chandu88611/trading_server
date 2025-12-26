import { Router } from "express";
import { ForexTraderUserDetailsController } from "../controllers/forexTraderUserDetails.controller";
import { requireAuth } from "../../../middleware/auth";

export class ForexTraderUserDetailsRouter {
  private router = Router();
  private controller = new ForexTraderUserDetailsController();

  constructor() {
    this.router.put(
      "/me",
      requireAuth,
      this.controller.upsertMyDetails.bind(this.controller)
    );
    this.router.get(
      "/me",
      requireAuth,
      this.controller.getMyDetails.bind(this.controller)
    );

    this.router.patch(
      "/:id",
      requireAuth,
      this.controller.updateMyDetailById.bind(this.controller)
    );
    this.router.delete(
      "/:id",
      requireAuth,
      this.controller.deleteMyDetailById.bind(this.controller)
    );
  }

  getRouter() {
    return this.router;
  }
}
