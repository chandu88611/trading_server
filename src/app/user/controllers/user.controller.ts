// src/app/user/controllers/user.controller.ts
import { Request, Response } from "express";
import { ControllerError } from "../../../types/error-handler";
import { UserService } from "../services/user.service";
import { AuthRequest, Roles } from "../../../middleware/auth";
import { HttpStatusCode } from "../../../types/constants";
import { CrmLifecycleSyncService } from "../../integrations/crm/services/crmLifecycleSync.service";
import { UserBillingDetails } from "../../../entity/UserBillingDetails";

export class UserController {
  private service = new UserService();
  private crmLifecycleSyncService = new CrmLifecycleSyncService();

  constructor() {}

  private ensureAdmin(req: AuthRequest) {
    const roles = req.auth?.roles ?? [];
    if (!roles.includes(Roles.ADMIN)) {
      throw {
        statusCode: HttpStatusCode._UNAUTHORISED,
        message: "Admin access required",
      };
    }
  }

  private serializeBillingDetails(data: UserBillingDetails | null) {
    if (!data) return null;

    const safeData = { ...(data as any) };
    delete safeData.razorpayContactId;
    delete safeData.razorpayFundAccountId;
    return safeData;
  }

  @ControllerError()
  public async registerUser(req: Request, res: Response): Promise<void> {
    const { provider, providerUserId, email, password, name, isAdmin, referralCode } =
      req.body ?? {};

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
        name,
        isAdmin === true,
        referralCode
      );
      if (result.isNewUser) {
        void this.crmLifecycleSyncService.syncUserRegistered(result.user.id);
      }

      res.status(201).json({
        message: "User registered via provider",
        user: {
          id: result.user.id,
          email: result.user.email,
          isAdmin: result.user.isAdmin,
        },
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

    const result = await this.service.registerWithEmail(
      email,
      password,
      name,
      isAdmin === true,
      referralCode
    );
    void this.crmLifecycleSyncService.syncUserRegistered(result.user.id);

    res.status(201).json({
      message: "User registered",
      user: {
        id: result.user.id,
        email: result.user.email,
        isAdmin: result.user.isAdmin,
      },
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
  async listUsers(req: AuthRequest, res: Response): Promise<void> {
    this.ensureAdmin(req);

    const rawPage = Number(req.query.page ?? 1);
    const rawLimit = Number(req.query.limit ?? 10);
    const search = String(req.query.search ?? "").trim();

    const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
    const limit = Number.isFinite(rawLimit)
      ? Math.min(100, Math.max(1, Math.floor(rawLimit)))
      : 10;

    const result = await this.service.listUsers({ page, limit, search });

    res.status(200).json({
      message: "Users fetched successfully",
      data: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        totalItems: result.total,
        totalPages: result.totalPages,
      },
    });
  }

  @ControllerError()
  async getReferral(req: AuthRequest, res: Response): Promise<void> {
    const userId = Number(req.auth!.userId);
    const data = await this.service.getReferralSummary(userId, false);

    res.status(200).json({
      message: "Referral summary fetched successfully",
      data,
    });
  }

  @ControllerError()
  async getUserReferral(req: AuthRequest, res: Response): Promise<void> {
    this.ensureAdmin(req);

    const userId = Number(req.params.userId);
    const data = await this.service.getReferralSummary(userId, true);

    res.status(200).json({
      message: "Referral summary fetched successfully",
      data,
    });
  }

  @ControllerError()
  async updateAdminStatus(req: AuthRequest, res: Response): Promise<void> {
    this.ensureAdmin(req);
    const userId = Number(req.params.userId);
    const { isAdmin } = req.body ?? {};

    if (typeof isAdmin !== "boolean") {
      res.status(400).json({ message: "isAdmin must be a boolean" });
      return;
    }

    const updatedUser = await this.service.updateAdminStatus(userId, isAdmin);
    res.status(200).json({
      message: "Admin status updated",
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        isAdmin: updatedUser.isAdmin,
      },
    });
  }

  @ControllerError()
  async getUserDetails(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.auth!.userId;
    const userData = await this.service.getUserDetails(Number(userId));
    res.status(200).json({ message: "ok", data: userData });
  }

  @ControllerError()
  async getDashboard(req: AuthRequest, res: Response): Promise<void> {
    const userId = Number(req.auth!.userId);
    const dashboardData = await this.service.getDashboardData(userId);

    res.status(200).json({
      message: "Dashboard fetched successfully",
      data: dashboardData,
    });
  }

  @ControllerError()
  async getSettings(req: AuthRequest, res: Response): Promise<void> {
    const userId = Number(req.auth!.userId);
    const settingsData = await this.service.getSettingsData(userId);

    res.status(200).json({
      message: "Settings fetched successfully",
      data: settingsData,
    });
  }

  @ControllerError()
  async getAdminStrategyTradeSchedule(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    this.ensureAdmin(req);

    const data = await this.service.getAdminStrategyTradeSchedule();

    res.status(200).json({
      message: "Admin strategy trade schedule fetched",
      data,
    });
  }

  @ControllerError()
  async updateAdminStrategyTradeSchedule(
    req: AuthRequest,
    res: Response
  ): Promise<void> {
    this.ensureAdmin(req);

    const data = await this.service.upsertAdminStrategyTradeSchedule(
      req.body ?? {}
    );

    res.status(200).json({
      message: "Admin strategy trade schedule updated",
      data,
    });
  }

  @ControllerError()
  async getBillingDetails(req: AuthRequest, res: Response): Promise<void> {
    const userId = Number(req.auth!.userId);

    const data = await this.service.getBillingDetails(userId);

    res.status(200).json({
      message: "Fetched billing details",
      data: this.serializeBillingDetails(data),
    });
  }

  @ControllerError()
  async updateBillingDetails(req: AuthRequest, res: Response): Promise<void> {
    const userId = Number(req.auth!.userId);

    const updated = await this.service.upsertBillingDetails(
      userId,
      req.body ?? {}
    );

    res.status(200).json({
      message: "Billing details updated",
      data: this.serializeBillingDetails(updated),
    });
  }

  @ControllerError()
  async updateTradeStatus(req: AuthRequest, res: Response): Promise<void> {
    const userId = Number(req.auth!.userId);
    const { allowTrade } = req.body;

    if (typeof allowTrade !== "boolean") {
      res.status(400).json({ message: "allowTrade must be a boolean" });
      return;
    }

    const updatedUser = await this.service.updateTradeStatus(
      userId,
      allowTrade
    );

    res.status(200).json({
      message: "Trade status updated",
      data: { id: updatedUser.id, allowTrade: updatedUser.allowTrade },
    });
  }

  @ControllerError()
  async updateCopyTradeStatus(req: AuthRequest, res: Response): Promise<void> {
    const userId = Number(req.auth!.userId);
    const { allowCopyTrade } = req.body;

    if (typeof allowCopyTrade !== "boolean") {
      res.status(400).json({ message: "allowCopyTrade must be a boolean" });
      return;
    }

    const updatedUser = await this.service.updateCopyTradeStatus(
      userId,
      allowCopyTrade
    );

    res.status(200).json({
      message: "Copy trade status updated",
      data: { id: updatedUser.id, allowCopyTrade: updatedUser.allowCopyTrade },
    });
  }

  @ControllerError()
  async getEdgingStatus(req: AuthRequest, res: Response): Promise<void> {
    const userId = Number(req.auth!.userId);
    const status = await this.service.getEdgingStatus(userId);

    res.status(200).json({
      message: "Edging status fetched",
      data: {
        userId: Number(status.userId),
        isEnabled: status.isEnabled,
        notes: status.notes ?? null,
        updatedAt: status.updatedAt,
      },
    });
  }

  @ControllerError()
  async updateEdgingStatus(req: AuthRequest, res: Response): Promise<void> {
    const userId = Number(req.auth!.userId);
    const { isEnabled, notes } = req.body ?? {};

    if (typeof isEnabled !== "boolean") {
      res.status(400).json({ message: "isEnabled must be a boolean" });
      return;
    }

    if (notes !== undefined && notes !== null && typeof notes !== "string") {
      res.status(400).json({ message: "notes must be a string" });
      return;
    }

    const status = await this.service.upsertEdgingStatus(userId, isEnabled, notes);

    res.status(200).json({
      message: "Edging status updated",
      data: {
        userId: Number(status.userId),
        isEnabled: status.isEnabled,
        notes: status.notes ?? null,
        updatedAt: status.updatedAt,
      },
    });
  }

  @ControllerError()
  async updateRiskLimits(req: AuthRequest, res: Response): Promise<void> {
    const userId = Number(req.auth!.userId);
    const {
      isEnabled,
      dailyLossLimit,
      dailyProfitTarget,
      maxTradesPerDay,
      cooldownAfterLossMins,
    } = req.body ?? {};

    if (typeof isEnabled !== "boolean") {
      res.status(400).json({ message: "isEnabled must be a boolean" });
      return;
    }

    const isNullableNonNegativeNumber = (value: unknown) =>
      value === null ||
      (typeof value === "number" && Number.isFinite(value) && value >= 0);
    const isNullableNonNegativeInteger = (value: unknown) =>
      value === null ||
      (typeof value === "number" &&
        Number.isInteger(value) &&
        Number.isFinite(value) &&
        value >= 0);

    if (
      dailyLossLimit !== undefined &&
      !isNullableNonNegativeNumber(dailyLossLimit)
    ) {
      res.status(400).json({
        message: "dailyLossLimit must be null or a non-negative number",
      });
      return;
    }

    if (
      dailyProfitTarget !== undefined &&
      !isNullableNonNegativeNumber(dailyProfitTarget)
    ) {
      res.status(400).json({
        message: "dailyProfitTarget must be null or a non-negative number",
      });
      return;
    }

    if (
      maxTradesPerDay !== undefined &&
      !isNullableNonNegativeInteger(maxTradesPerDay)
    ) {
      res.status(400).json({
        message: "maxTradesPerDay must be null or a non-negative integer",
      });
      return;
    }

    if (
      cooldownAfterLossMins !== undefined &&
      !isNullableNonNegativeInteger(cooldownAfterLossMins)
    ) {
      res.status(400).json({
        message:
          "cooldownAfterLossMins must be null or a non-negative integer",
      });
      return;
    }

    const riskLimits = await this.service.upsertRiskLimits(userId, {
      isEnabled,
      dailyLossLimit,
      dailyProfitTarget,
      maxTradesPerDay,
      cooldownAfterLossMins,
    });

    res.status(200).json({
      message: "Risk limits updated",
      data: riskLimits,
    });
  }
}
