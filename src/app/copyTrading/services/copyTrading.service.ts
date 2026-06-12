import { HttpStatusCode } from "../../../types/constants";
import { CopyTradingDBService } from "./copyTrading.db";
import { CopyFollowStatus } from "../../../entity/CopyTradingFollow";

export class CopyTradingService {
  private dbService: CopyTradingDBService;

  constructor() {
    this.dbService = new CopyTradingDBService();
  }

  async getMyMaster(userId: number) {
    if (!userId) throw { status: HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
    return this.dbService.getMyMaster(userId);
  }

  async upsertMyMaster(args: {
    userId: number;
    tradingAccountId: number;
    isActive?: boolean;
  }) {
    if (!args.userId) throw { status: HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
    if (!args.tradingAccountId) throw { status: HttpStatusCode._BAD_REQUEST, message: "tradingAccountId_required" };
    return this.dbService.upsertMyMaster(args);
  }

  async listMasters(args: { page: number; limit: number }) {
    return this.dbService.listMasters(args);
  }

  async followMaster(args: {
    masterId: number;
    followerUserId: number;
    followerTradingAccountId: number;
  }) {
    if (!args.followerUserId) throw { status: HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
    if (!args.masterId) throw { status: HttpStatusCode._BAD_REQUEST, message: "masterId_required" };
    if (!args.followerTradingAccountId) throw { status: HttpStatusCode._BAD_REQUEST, message: "followerTradingAccountId_required" };
    return this.dbService.followMaster(args);
  }

  async listMyFollows(args: {
    followerUserId: number;
    page: number;
    limit: number;
    status?: string;
  }) {
    if (!args.followerUserId) throw { status: HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
    return this.dbService.listMyFollows(args);
  }

  async updateMyFollow(args: {
    followId: number;
    followerUserId: number;
    status?: string;
  }) {
    if (!args.followerUserId) throw { status: HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
    const status = args.status as CopyFollowStatus | undefined;
    return this.dbService.updateMyFollow({ ...args, status });
  }

  async listMyFollowers(args: {
    ownerUserId: number;
    page: number;
    limit: number;
    status?: string;
  }) {
    if (!args.ownerUserId) throw { status: HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
    return this.dbService.listMyFollowers(args);
  }

  async decideFollowerRequest(args: {
    ownerUserId: number;
    followId: number;
    action: "approve" | "reject";
  }) {
    if (!args.ownerUserId) throw { status: HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
    return this.dbService.decideFollowerRequest(args);
  }
}
