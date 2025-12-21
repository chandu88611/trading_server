// src/app/user/controllers/user.controller.ts
import { Request, Response } from "express";
import { ControllerError } from "../../../types/error-handler";
import { UserService } from "../services/user.service";
import { AuthRequest } from "../../../middleware/auth";

export class UserController {
  private service = new UserService();

  constructor() {}

  @ControllerError()
  public async registerUser(req: Request, res: Response): Promise<void> {
    const { provider, providerUserId, email, password, name } = req.body ?? {};

    if (provider) {
      if (!providerUserId || !email) {
        res.status(400).json({
          message: "providerUserId and email are required for provider signup",
        });
        return;
      }

      const result = await this.service.registerWithProvider(
        provider,
        providerUserId,
        email,
        name
      );

      res.status(201).json({
        message: "User registered via provider",
        user: { id: result.user.id, email: result.user.email },
        tokens: {
          access: result.accessToken,
          refresh: result.refreshToken,
        },
      });
      return;
    }

    // Normal email/password registration
    if (!email || !password) {
      res
        .status(400)
        .json({ message: "email and password are required for signup" });
      return;
    }

    const result = await this.service.registerWithEmail(email, password, name);

    res.status(201).json({
      message: "User registered",
      user: { id: result.user.id, email: result.user.email },
      tokens: {
        access: result.accessToken,
        refresh: result.refreshToken,
      },
    });
  }
  @ControllerError()
  async verifyEmail(req: Request, res: Response): Promise<void> {
    const { token } = req.query as { token?: string };

    if (!token) {
      res.status(400).json({ message: "Invalid token" });
      return;
    }

    await this.service.verifyEmail(token);

    res.status(200).json({
      message: "Email verified successfully",
    });
  }

  @ControllerError()
  async getUserDetails(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.auth!.userId;
    const userData = await this.service.getUserDetails(Number(userId));
    res.status(200).json({ message: "ok", data: userData });
  }
}
