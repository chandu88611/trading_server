import { Router } from "express";
import { requireAuth } from "../../../middleware/auth";
import { CopyTradingController } from "../controller/copyTrading.controller";

export class CopyTradingRouter {
  private router: Router;

  constructor() {
    this.router = Router();
    this.init();
  }

  init() {
    const controller = new CopyTradingController();

    this.router.get("/master/me", requireAuth, controller.getMyMaster);
    this.router.post("/master", requireAuth, controller.upsertMyMaster);

    this.router.get("/masters", requireAuth, controller.listMasters);

    this.router.post("/follow", requireAuth, controller.followMaster);
    this.router.get("/follows/me", requireAuth, controller.listMyFollows);
    this.router.patch(
      "/follows/:followId",
      requireAuth,
      controller.updateMyFollow
    );

    this.router.get("/followers/me", requireAuth, controller.listMyFollowers);
    this.router.patch(
      "/followers/:followId/decision",
      requireAuth,
      controller.decideFollowerRequest
    );
  }

  getRouter() {
    return this.router;
  }
}
