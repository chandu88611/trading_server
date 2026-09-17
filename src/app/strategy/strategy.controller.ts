import AppDataSource from "../../db/data-source";
import { UserStrategyInstance } from "../../entity/UserStrategyInstance";
import { Response } from "express";
import { ControllerError } from "../../types/error-handler";
import { StrategyService } from "./strategy";
import { AuthRequest, Roles } from "../../middleware/auth";
import { HttpStatusCode } from "../../types/constants";

export class StrategyController {
  private service = new StrategyService();

  @ControllerError()
  async listUser(req: AuthRequest, res: Response) {
    const data=await AppDataSource.getRepository(UserStrategyInstance).find({where:{userId:Number(req.auth!.userId)},relations:{strategy:true,plan:true,subscription:true},order:{id:"DESC"}});
    res.json({data:data.filter(row=>row.subscription?.statusV2==="active").map(row=>({id:row.id,strategyId:row.strategyId,name:row.strategy.name,description:row.strategy.description,planName:row.plan.name,planId:row.planId,status:row.status,volume:row.volume}))});
  }

  private isAdmin(req: AuthRequest) {
    const roles = req.auth?.roles ?? [];
    return roles.includes(Roles.ADMIN);
  }

  private ensureAdmin(req: AuthRequest) {
    if (!this.isAdmin(req)) {
      throw {
        statusCode: HttpStatusCode._UNAUTHORISED,
        message: "Admin access required",
      };
    }
  }

  private parseOptionalBoolean(value: unknown, fieldName: string) {
    if (value === undefined) return undefined;
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw === "boolean") return raw;
    const normalized = String(raw).trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    throw {
      statusCode: HttpStatusCode._BAD_REQUEST,
      message: `${fieldName} must be a boolean`,
    };
  }

  private parseOptionalNumber(value: unknown, fallback: number) {
    if (value === undefined) return fallback;
    const raw = Array.isArray(value) ? value[0] : value;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  @ControllerError()
  async list(req: AuthRequest, res: Response) {
    const isAdmin = this.isAdmin(req);
    const query = req.query as any;
    const result = await this.service.list({
      availableOnly: !isAdmin,
      isActive: isAdmin
        ? this.parseOptionalBoolean(query.isActive, "isActive")
        : undefined,
      isDeprecated: isAdmin
        ? this.parseOptionalBoolean(query.isDeprecated, "isDeprecated")
        : undefined,
      category: query.category ? String(query.category) : undefined,
      searchParam: query.searchParam ? String(query.searchParam) : undefined,
      chunkSize: this.parseOptionalNumber(query.chunkSize, 20),
      initialOffset: this.parseOptionalNumber(query.initialOffset, 0),
    });

    res.status(200).json({
      message: "Fetched strategies",
      data: result.rows,
      total: result.total,
    });
  }

  @ControllerError()
  async create(req: AuthRequest, res: Response) {
    this.ensureAdmin(req);
    const s = await this.service.create(req.body);
    res.status(201).json({ message: "Strategy created", data: s });
  }

  @ControllerError()
  async get(req: AuthRequest, res: Response) {
    const strategyId = Number(req.params.strategyId);
    const data = await this.service.getById(strategyId, {
      availableOnly: !this.isAdmin(req),
      userId: req.auth?.userId ? Number(req.auth.userId) : null,
    });
    res.status(200).json({ message: "Fetched strategy", data });
  }

  @ControllerError()
  async subscribe(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const strategyId = Number(req.params.strategyId);
    const data = await this.service.subscribe(userId, strategyId, req.body ?? {});
    res.status(200).json({ message: "strategy_subscription_saved", data });
  }

  @ControllerError()
  async myPerformance(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const strategyId = Number(req.params.strategyId);
    const accountId =
      req.query.accountId === undefined || req.query.accountId === ""
        ? null
        : Number(req.query.accountId);
    const data = await this.service.getMyPerformance(userId, strategyId, accountId);
    res.status(200).json({ message: "strategy_my_performance", data });
  }

  @ControllerError()
  async update(req: AuthRequest, res: Response) {
    this.ensureAdmin(req);
    const strategyId = Number(req.params.strategyId);
    const data = await this.service.update(strategyId, req.body);
    res.status(200).json({ message: "Strategy updated", data });
  }

  @ControllerError()
  async retire(req: AuthRequest, res: Response) {
    this.ensureAdmin(req);
    const strategyId = Number(req.params.strategyId);
    const data = await this.service.retire(strategyId);
    res.status(200).json({ message: "Strategy retired", data });
  }

  @ControllerError()
  async enableStrategy(req: AuthRequest, res: Response) {
    const strategyId = Number(req.params.strategyId);
    if (this.isAdmin(req)) {
      const data = await this.service.setStrategyActive(strategyId, true);
      res.status(200).json({ message: "strategy_enabled", data });
      return;
    }

    const userId = Number(req.auth!.userId);
    const data = await this.service.setUserStrategyStatusByStrategyId(
      userId,
      strategyId,
      "active"
    );
    res.status(200).json({ message: "user_strategy_enabled", data });
  }

  @ControllerError()
  async disableStrategy(req: AuthRequest, res: Response) {
    const strategyId = Number(req.params.strategyId);
    if (this.isAdmin(req)) {
      const data = await this.service.setStrategyActive(strategyId, false);
      res.status(200).json({ message: "strategy_disabled", data });
      return;
    }

    const userId = Number(req.auth!.userId);
    const data = await this.service.setUserStrategyStatusByStrategyId(
      userId,
      strategyId,
      "paused"
    );
    res.status(200).json({ message: "user_strategy_disabled", data });
  }

  @ControllerError()
  async enableUserStrategyInstance(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const instanceId = Number(req.params.instanceId);
    const data = await this.service.setUserStrategyInstanceStatus(
      userId,
      instanceId,
      "active"
    );
    res.status(200).json({ message: "user_strategy_enabled", data });
  }

  @ControllerError()
  async disableUserStrategyInstance(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const instanceId = Number(req.params.instanceId);
    const data = await this.service.setUserStrategyInstanceStatus(
      userId,
      instanceId,
      "paused"
    );
    res.status(200).json({ message: "user_strategy_disabled", data });
  }

  @ControllerError()
  async updateUserStrategyInstanceVolume(req: AuthRequest, res: Response) {
    const userId = Number(req.auth!.userId);
    const instanceId = Number(req.params.instanceId);
    const volume = Number(req.body?.volume);

    const data = await this.service.setUserStrategyInstanceVolume(
      userId,
      instanceId,
      volume
    );

    res.status(200).json({ message: "user_strategy_volume_updated", data });
  }
}
