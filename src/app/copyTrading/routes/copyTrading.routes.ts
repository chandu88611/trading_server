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
      controller.getMyMaster.bind(controller)
    );
    this.router.post(
      "/master",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.upsertMyMaster.bind(controller)
    );

    this.router.get(
      "/masters",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.listMasters.bind(controller)
    );

    this.router.post(
      "/follow",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.followMaster.bind(controller)
    );
    this.router.get(
      "/follows/me",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.listMyFollows.bind(controller)
    );
    this.router.patch(
      "/follows/:followId",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.updateMyFollow.bind(controller)
    );

    this.router.get(
      "/followers/me",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.listMyFollowers.bind(controller)
    );
    this.router.patch(
      "/followers/:followId/decision",
      requireAuth([Roles.USER, Roles.ADMIN]),
      controller.decideFollowerRequest.bind(controller)
    );
  }

  getRouter() {
    return this.router;
  }
}
