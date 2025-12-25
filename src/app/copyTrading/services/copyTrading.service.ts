import AppDataSource from "../../../db/data-source";
import { QueryRunner } from "typeorm";
import { HttpStatusCode } from "../../../types/constants";
import { CopyTradingDBService } from "./copyTrading.db";
import { CopyEventType, CopyTradeSide } from "../../../entity/CopyMasterEvent";

function normalizeAction(action?: string) {
  return String(action || "").trim().toUpperCase();
}

function mapToCopyEvent(action?: string): {
  eventType: CopyEventType;
  side: CopyTradeSide | null;
} {
  const a = normalizeAction(action);

  if (a === "BUY" || a === "LONG")
    return { eventType: CopyEventType.OPEN, side: CopyTradeSide.BUY };
  if (a === "SELL" || a === "SHORT")
    return { eventType: CopyEventType.OPEN, side: CopyTradeSide.SELL };

  if (a.includes("CLOSE")) return { eventType: CopyEventType.CLOSE, side: null };
  if (a.includes("MODIFY")) return { eventType: CopyEventType.MODIFY, side: null };
  if (a.includes("PARTIAL"))
    return { eventType: CopyEventType.PARTIAL_CLOSE, side: null };

  return { eventType: CopyEventType.OPEN, side: null };
}

export class CopyTradingService {
  private dbService: CopyTradingDBService;

  constructor() {
    this.dbService = new CopyTradingDBService();
  }

  // ---------------------------
  // READ APIs
  // ---------------------------

  async getMyMaster(userId: number) {
    if (!userId) throw { status: HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
    return this.dbService.getMyMaster(userId);
  }

  async listMasters(args: {
    viewerUserId?: number;
    visibility?: "public" | "unlisted" | "private";
    page: number;
    limit: number;
  }) {
    return this.dbService.listMasters(args);
  }

  async listMyFollows(args: {
    followerUserId: number;
    page: number;
    limit: number;
    status?: string;
  }) {
    if (!args.followerUserId)
      throw { status: HttpStatusCode._UNAUTHORISED, message: "unauthorized" };

    return this.dbService.listMyFollows(args);
  }

  async listMyFollowers(args: {
    ownerUserId: number;
    page: number;
    limit: number;
    status?: string;
  }) {
    if (!args.ownerUserId)
      throw { status: HttpStatusCode._UNAUTHORISED, message: "unauthorized" };

    return this.dbService.listMyFollowers(args);
  }

  // ---------------------------
  // WRITE APIs (Transaction)
  // ---------------------------

  async upsertMyMaster(args: {
    userId: number;
    tradingAccountId: number;
    name?: string;
    description?: string | null;
    visibility?: "private" | "unlisted" | "public";
    requiresApproval?: boolean;
  }) {
    if (!args.userId) throw { status: HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
    if (!args.tradingAccountId)
      throw { status: HttpStatusCode._BAD_REQUEST, message: "tradingAccountId_required" };

    const qr = AppDataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const out = await this.dbService.upsertMyMaster(args, qr);
      await qr.commitTransaction();
      return out;
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  async followMaster(args: {
    followerUserId: number;
    masterId: number;
    followerTradingAccountId: number;
    subscriptionId?: number;

    riskMode?: string;
    riskValue?: any;
    maxLot?: any;
    maxOpenPositions?: any;
    maxDailyLoss?: any;
    slippageTolerance?: any;
    symbolWhitelist?: string[];
  }) {
    if (!args.followerUserId)
      throw { status: HttpStatusCode._UNAUTHORISED, message: "unauthorized" };

    if (!args.masterId || !args.followerTradingAccountId) {
      throw {
        status: HttpStatusCode._BAD_REQUEST,
        message: "masterId_and_followerTradingAccountId_required",
      };
    }

    const qr = AppDataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const out = await this.dbService.followMaster(args, qr);
      await qr.commitTransaction();
      return out;
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  async updateMyFollow(args: {
    followerUserId: number;
    followId: number;

    status?: string;
    riskMode?: string;
    riskValue?: any;
    maxLot?: any;
    maxOpenPositions?: any;
    maxDailyLoss?: any;
    slippageTolerance?: any;
    symbolWhitelist?: string[];
  }) {
    if (!args.followerUserId)
      throw { status: HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
    if (!args.followId)
      throw { status: HttpStatusCode._BAD_REQUEST, message: "followId_required" };

    const qr = AppDataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const out = await this.dbService.updateMyFollow(args, qr);
      await qr.commitTransaction();
      return out;
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  async decideFollowerRequest(args: {
    ownerUserId: number;
    followId: number;
    action: "approve" | "reject";
  }) {
    if (!args.ownerUserId)
      throw { status: HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
    if (!args.followId)
      throw { status: HttpStatusCode._BAD_REQUEST, message: "followId_required" };

    const qr = AppDataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const out = await this.dbService.decideFollowerRequest(args, qr);
      await qr.commitTransaction();
      return out;
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  // ---------------------------
  // EXISTING: Master signal -> follower tasks
  // ---------------------------

  async fanoutFromMasterSignal(
    args: {
      userId: number;
      brokerJobId: number;
      alertSnapshotId: number;
      action: string;
      symbol: string;
      exchange?: string;
      price?: number | string | null;
      signalTime: Date;
    },
    queryRunner?: QueryRunner
  ) {
    const master = await this.dbService.getOrCreateDefaultMasterForUser(
      args.userId,
      queryRunner
    );

    const { eventType, side } = mapToCopyEvent(args.action);

    const masterOrderRef = `job:${args.brokerJobId}:alert:${args.alertSnapshotId}`;

    const masterEvent = await this.dbService.createMasterEvent(
      {
        masterId: Number(master.id),
        eventType,
        symbol: args.symbol,
        side,
        price: args.price ?? null,
        signalTime: args.signalTime,
        masterOrderRef,
        payload: {
          source: "alert_snapshot",
          brokerJobId: args.brokerJobId,
          alertSnapshotId: args.alertSnapshotId,
          action: args.action,
          symbol: args.symbol,
          exchange: args.exchange,
          price: args.price ?? null,
          signalTime: args.signalTime,
        },
      },
      queryRunner
    );

    const follows = await this.dbService.getEligibleFollows(
      Number(master.id),
      args.symbol,
      queryRunner
    );

    const payloadBase = {
      master: { id: master.id, ownerUserId: master.ownerUserId },
      masterEvent: {
        id: masterEvent.id,
        type: masterEvent.eventType,
        symbol: masterEvent.symbol,
        side: masterEvent.side,
        price: masterEvent.price,
        masterOrderRef: masterEvent.masterOrderRef,
        signalTime: masterEvent.signalTime,
      },
    };

    const res = await this.dbService.enqueueTasks(
      { masterEventId: Number(masterEvent.id), follows, payloadBase },
      queryRunner
    );

    return {
      masterId: master.id,
      masterEventId: masterEvent.id,
      queued: res.queued,
    };
  }
}
