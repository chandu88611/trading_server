import { Router } from "express";
import { UserController } from "../controllers";
import { requireAuth, Roles } from "../../../middleware/auth";
import { createRateLimiter } from "../../../middleware/rateLimit";
import { validateRegister } from "../../../middleware/validate";

export class UserRouter {
  private userRoutes: Router;

  constructor() {
    this.userRoutes = Router();
    this.initApplicationRoutes();
  }

  initApplicationRoutes() {
    const userController: UserController = new UserController();
    this.userRoutes.post(
      "/register",
      // invoke factory to get actual middleware
      createRateLimiter({ max: 10, windowMs: 60_000 }),
      validateRegister,
      userController.registerUser.bind(userController)
    );

    this.userRoutes.get(
      "/verify-email",
      createRateLimiter({ max: 20, windowMs: 60_000 }),
      userController.verifyEmail.bind(userController)
    );

    this.userRoutes.get(
      "/billing",
      requireAuth([Roles.USER, Roles.ADMIN]),
      userController.getBillingDetails.bind(userController)
    );

    this.userRoutes.put(
      "/billing",
      requireAuth([Roles.USER, Roles.ADMIN]),
      userController.updateBillingDetails.bind(userController)
    );

    this.userRoutes.put(
      "/copy-trade-status",
      requireAuth([Roles.USER, Roles.ADMIN]),
      userController.updateCopyTradeStatus.bind(userController)
    );

    this.userRoutes.put(
      "/trade-status",
      requireAuth([Roles.USER, Roles.ADMIN]),
      userController.updateTradeStatus.bind(userController)
    );

    this.userRoutes.get(
      "/me",
      requireAuth([Roles.USER, Roles.ADMIN]),
      userController.getUserDetails.bind(userController)
    );
  }

  getRouter() {
    return this.userRoutes;
  }
}
