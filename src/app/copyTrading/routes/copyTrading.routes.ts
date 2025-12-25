import { Router } from "express";
import { requireAuth, Roles } from "../../../middleware/auth";
import { CopyTradingController } from "../controller/copyTrading.controller";

export class CopyTradingRouter {
  private router: Router;

  constructor() {
    this.router = Router();
    this.init();
  }

  init() {
    const controller = new CopyTradingController();

    this.router.get(
      "/master/me",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.getMyMaster
    );
    this.router.post(
      "/master",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.upsertMyMaster
    );

    this.router.get(
      "/masters",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.listMasters
    );

    this.router.post(
      "/follow",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.followMaster
    );
    this.router.get(
      "/follows/me",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.listMyFollows
    );
    this.router.patch(
      "/follows/:followId",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.updateMyFollow
    );

    this.router.get(
      "/followers/me",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.listMyFollowers
    );
    this.router.patch(
      "/followers/:followId/decision",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.decideFollowerRequest
    );
  }

  getRouter() {
    return this.router;
  }
}
