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

    this.userRoutes.get("/me", requireAuth([Roles.USER]), (req, res) =>
      res.json({ message: "ok", user: (req as any).auth })
    );
  }

  getRouter() {
    return this.userRoutes;
  }
}
