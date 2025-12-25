import { Request, Response } from "express";
import { ControllerError } from "../../../types/error-handler";
import { AuthRequest } from "../../../middleware/auth";
import { HttpStatusCode } from "../../../types/constants";
import { CopyTradingService } from "../services/copyTrading.service";

function toInt(v: any, fallback?: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : (fallback as any);
}

function getUserId(req: AuthRequest) {
  const r: any = req as any;
  const userId = Number(req.auth!.userId);
  return userId && Number.isFinite(userId) ? userId : null;
}

type Visibility = "private" | "unlisted" | "public";

function parseVisibility(v: any, fallback: Visibility = "public"): Visibility {
  const s = String(v || "")
    .trim()
    .toLowerCase();
  if (s === "private" || s === "unlisted" || s === "public") return s;
  return fallback;
}

export class CopyTradingController {
  private service: CopyTradingService;

  constructor() {
    this.service = new CopyTradingService();
  }

  @ControllerError()
  async upsertMyMaster(req: AuthRequest, res: Response) {
    const userId = getUserId(req);
    if (!userId) {
      return res
        .status(HttpStatusCode._UNAUTHORISED)
        .json({ message: "unauthorized" });
    }

    const tradingAccountId = toInt((req.body as any)?.tradingAccountId);
    if (!tradingAccountId) {
      return res
        .status(HttpStatusCode._BAD_REQUEST)
        .json({ message: "tradingAccountId_required" });
    }

    const out = await this.service.upsertMyMaster({
      userId: Number(userId),
      tradingAccountId,
      name: (req.body as any)?.name,
      description: (req.body as any)?.description,
      visibility: (req.body as any)?.visibility,
      requiresApproval: Boolean((req.body as any)?.requiresApproval),
    });

    return res.status(HttpStatusCode._SUCCESS).json(out);
  }

  /**
   * Get my master profile (create default if needed)
   */
  @ControllerError()
  async getMyMaster(req: Request, res: Response) {
    const userId = getUserId(req);
    console.log("userId **********", userId);
    if (!userId) {
      return res
        .status(HttpStatusCode._UNAUTHORISED)
        .json({ message: "unauthorized" });
    }

    const out = await this.service.getMyMaster(Number(userId));
    return res.status(HttpStatusCode._SUCCESS).json(out);
  }
  @ControllerError()
  async listMasters(req: Request, res: Response) {
    const userId = getUserId(req as any);
    const page = Math.max(1, toInt((req.query as any)?.page, 1));
    const limit = Math.min(
      100,
      Math.max(1, toInt((req.query as any)?.limit, 20))
    );

    const visibility = parseVisibility(
      (req.query as any)?.visibility,
      "public"
    );

    const out = await this.service.listMasters({
      viewerUserId: userId ? Number(userId) : undefined,
      visibility,
      page,
      limit,
    });

    return res.status(HttpStatusCode._SUCCESS).json(out);
  }

  @ControllerError()
  async followMaster(req: Request, res: Response) {
    const userId = getUserId(req);
    if (!userId) {
      return res
        .status(HttpStatusCode._UNAUTHORISED)
        .json({ message: "unauthorized" });
    }

    const masterId = toInt((req.body as any)?.masterId);
    const followerTradingAccountId = toInt(
      (req.body as any)?.followerTradingAccountId
    );

    if (!masterId || !followerTradingAccountId) {
      return res
        .status(HttpStatusCode._BAD_REQUEST)
        .json({ message: "masterId_and_followerTradingAccountId_required" });
    }

    const out = await this.service.followMaster({
      followerUserId: Number(userId),
      masterId,
      followerTradingAccountId,
      subscriptionId: (req.body as any)?.subscriptionId
        ? toInt((req.body as any)?.subscriptionId)
        : undefined,

      riskMode: (req.body as any)?.riskMode,
      riskValue: (req.body as any)?.riskValue,
      maxLot: (req.body as any)?.maxLot,
      maxOpenPositions: (req.body as any)?.maxOpenPositions,
      maxDailyLoss: (req.body as any)?.maxDailyLoss,
      slippageTolerance: (req.body as any)?.slippageTolerance,
      symbolWhitelist: (req.body as any)?.symbolWhitelist,
    });

    return res.status(HttpStatusCode._SUCCESS).json(out);
  }

  @ControllerError()
  async listMyFollows(req: Request, res: Response) {
    const userId = getUserId(req);
    if (!userId) {
      return res
        .status(HttpStatusCode._UNAUTHORISED)
        .json({ message: "unauthorized" });
    }

    const page = Math.max(1, toInt((req.query as any)?.page, 1));
    const limit = Math.min(
      100,
      Math.max(1, toInt((req.query as any)?.limit, 20))
    );
    const status = (req.query as any)?.status
      ? String((req.query as any)?.status)
      : undefined;

    const out = await this.service.listMyFollows({
      followerUserId: Number(userId),
      page,
      limit,
      status,
    });

    return res.status(HttpStatusCode._SUCCESS).json(out);
  }

  @ControllerError()
  async updateMyFollow(req: Request, res: Response) {
    const userId = getUserId(req);
    if (!userId) {
      return res
        .status(HttpStatusCode._UNAUTHORISED)
        .json({ message: "unauthorized" });
    }

    const followId = toInt((req.params as any)?.followId);
    if (!followId) {
      return res
        .status(HttpStatusCode._BAD_REQUEST)
        .json({ message: "followId_required" });
    }

    const out = await this.service.updateMyFollow({
      followerUserId: Number(userId),
      followId,
      status: (req.body as any)?.status,
      riskMode: (req.body as any)?.riskMode,
      riskValue: (req.body as any)?.riskValue,
      maxLot: (req.body as any)?.maxLot,
      maxOpenPositions: (req.body as any)?.maxOpenPositions,
      maxDailyLoss: (req.body as any)?.maxDailyLoss,
      slippageTolerance: (req.body as any)?.slippageTolerance,
      symbolWhitelist: (req.body as any)?.symbolWhitelist,
    });

    return res.status(HttpStatusCode._SUCCESS).json(out);
  }

  @ControllerError()
  async listMyFollowers(req: Request, res: Response) {
    const userId = getUserId(req);
    if (!userId) {
      return res
        .status(HttpStatusCode._UNAUTHORISED)
        .json({ message: "unauthorized" });
    }

    const page = Math.max(1, toInt((req.query as any)?.page, 1));
    const limit = Math.min(
      100,
      Math.max(1, toInt((req.query as any)?.limit, 20))
    );
    const status = (req.query as any)?.status
      ? String((req.query as any)?.status)
      : undefined;

    const out = await this.service.listMyFollowers({
      ownerUserId: Number(userId),
      page,
      limit,
      status,
    });

    return res.status(HttpStatusCode._SUCCESS).json(out);
  }

  @ControllerError()
  async decideFollowerRequest(req: Request, res: Response) {
    const userId = getUserId(req);
    if (!userId) {
      return res
        .status(HttpStatusCode._UNAUTHORISED)
        .json({ message: "unauthorized" });
    }

    const followId = toInt((req.params as any)?.followId);
    const action = String((req.body as any)?.action || "").toLowerCase();

    if (!followId || !["approve", "reject"].includes(action)) {
      return res
        .status(HttpStatusCode._BAD_REQUEST)
        .json({ message: "followId_and_valid_action_required" });
    }

    const out = await this.service.decideFollowerRequest({
      ownerUserId: Number(userId),
      followId,
      action: action as "approve" | "reject",
    });

    return res.status(HttpStatusCode._SUCCESS).json(out);
  }
}
