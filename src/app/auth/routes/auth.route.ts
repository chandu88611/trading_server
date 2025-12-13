import { Router } from "express";
import AuthController from "../controllers/auth.controller";
import { AuthGuard } from "../services/auth.guard";

export class AuthRouter {
  private authRoutes: Router;

  constructor() {
    this.authRoutes = Router();
    this.init();
  }

  init() {
    this.authRoutes.post("/login", (req, res) =>
      AuthController.login(req, res)
    );
    this.authRoutes.post("/refresh", (req, res) =>
      AuthController.refresh(req, res)
    );
    this.authRoutes.post("/google", (req, res) =>
      AuthController.google(req, res)
    );
    this.authRoutes.post("/revoke", (req, res) =>
      AuthController.revoke(req, res)
    );
    this.authRoutes.get("/me", AuthGuard.requireUser, AuthController.me);
  }

  getRouter() {
    return this.authRoutes;
  }
}

export default AuthRouter;
