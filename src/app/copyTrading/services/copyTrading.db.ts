import AppDataSource from "../../../db/data-source";
import { HttpStatusCode } from "../../../types/constants";
import { TradingAccountStatus } from "../../subscriptionPlan/enums/subscriberPlan.enum";
import { DeepPartial, QueryRunner } from "typeorm";
import {
  CopyTradingMaster,
  CopyMasterSourceType,
} from "../../../entity/CopyTradingMaster";
import {
  CopyTradingFollow,
  CopyFollowStatus,
} from "../../../entity/CopyTradingFollow";
import {
  CopyMasterEvent,
  CopyEventType,
  CopyTradeSide,
} from "../../../entity/CopyMasterEvent";
import { CopyTradeTask, CopyTaskStatus } from "../../../entity/CopyTradeTask";
import { UserTradingAccount } from "../../../entity/UserTradingAccount";

export class CopyTradingDBService {
  /**
   * Get manager depending on transaction
   */
  private mgr(qr?: QueryRunner) {
    return qr ? qr.manager : AppDataSource.manager;
  }

  /**
   * Ensure a master profile exists for this user.
   * Master MUST be tied to a verified trading account because of DB constraint.
   */
  async getOrCreateDefaultMasterForUser(
    userId: number,
    qr?: QueryRunner
  ): Promise<CopyTradingMaster> {
    const manager = this.mgr(qr);

    const existing = await manager
      .getRepository(CopyTradingMaster)
      .createQueryBuilder("m")
      .where("m.ownerUserId = :userId", { userId })
      .andWhere("m.sourceType = :st", {
        st: CopyMasterSourceType.TRADING_ACCOUNT,
      })
      .andWhere("m.deletedAt IS NULL")
      .orderBy("m.updatedAt", "DESC")
      .getOne();

    if (existing) return existing;

    const acc = await manager
      .getRepository(UserTradingAccount)
      .createQueryBuilder("ta")
      .leftJoin("ta.user", "u")
      .where("u.id = :userId", { userId })
      .andWhere("ta.status = :st", { st: TradingAccountStatus.VERIFIED })
      .orderBy("ta.lastVerifiedAt", "DESC")
      .addOrderBy("ta.createdAt", "DESC")
      .getOne();

    if (!acc) {
      throw {
        status: HttpStatusCode._BAD_REQUEST,
        message: "no_verified_trading_account_for_master",
      };
    }

    const masterRepo = manager.getRepository(CopyTradingMaster);

    // ✅ IMPORTANT: do NOT use `as any` here
    const data: DeepPartial<CopyTradingMaster> = {
      ownerUserId: userId as any, // keep if your entity type is string; otherwise remove `as any`
      sourceType: CopyMasterSourceType.TRADING_ACCOUNT,
      sourceTradingAccountId: acc.id as any, // same note
      name: `Master-${userId}`,
      description: null,
      visibility: "private" as any,
      requiresApproval: false,
      isActive: true,
      metadata: {},
    };

    const created = masterRepo.create(data); // -> CopyTradingMaster (not array)
    const saved = await masterRepo.save(created); // -> CopyTradingMaster (not union)
    return saved;
  }

  async createMasterEvent(
    args: {
      masterId: number;
      eventType: CopyEventType;
      symbol: string;
      side?: CopyTradeSide | null;
      price?: number | string | null;
      signalTime: Date;
      masterOrderRef?: string | null;
      payload?: Record<string, any>;
    },
    qr?: QueryRunner
  ): Promise<CopyMasterEvent> {
    const manager = this.mgr(qr);
    const repo = manager.getRepository(CopyMasterEvent);

    const data: DeepPartial<CopyMasterEvent> = {
      masterId: args.masterId,
      eventType: args.eventType,
      symbol: args.symbol,
      side: args.side ?? null,
      price:
        args.price !== undefined && args.price !== null
          ? String(args.price)
          : null,
      signalTime: args.signalTime,
      masterOrderRef: args.masterOrderRef ?? null,
      masterPositionRef: null,
      payload: args.payload ?? {},
    };

    const ev = repo.create(data);
    const saved = await repo.save(ev);
    return saved;
  }

  async getEligibleFollows(masterId: number, symbol: string, qr?: QueryRunner) {
    const manager = this.mgr(qr);

    return await manager
      .createQueryBuilder()
      .from("copy_trading_follows", "f")
      .innerJoin("users", "u", "u.id = f.follower_user_id")
      .innerJoin(
        "user_trading_accounts",
        "ta",
        "ta.id = f.follower_trading_account_id"
      )
      .select([
        "f.id as id",
        "f.follower_user_id as followerUserId",
        "f.follower_trading_account_id as followerTradingAccountId",
        "f.subscription_id as subscriptionId",
        "f.risk_mode as riskMode",
        "f.risk_value as riskValue",
        "f.max_lot as maxLot",
        "f.max_open_positions as maxOpenPositions",
        "f.max_daily_loss as maxDailyLoss",
        "f.slippage_tolerance as slippageTolerance",
        "f.symbol_whitelist as symbolWhitelist",
        "f.metadata as metadata",
      ])
      .where("f.master_id = :masterId", { masterId })
      .andWhere("f.status = :status", { status: CopyFollowStatus.ACTIVE })
      .andWhere("u.is_active = TRUE")
      .andWhere("COALESCE(u.allow_trade, TRUE) = TRUE")
      .andWhere("COALESCE(u.allow_copy_trade, TRUE) = TRUE")
      .andWhere("ta.status = :taStatus", {
        taStatus: TradingAccountStatus.VERIFIED,
      })
      .andWhere(
        "(f.symbol_whitelist IS NULL OR :symbol = ANY(f.symbol_whitelist))",
        { symbol }
      )
      .getRawMany();
  }

  /**
   * Bulk queue tasks (fast + no Repository.save overload issues)
   */
  async enqueueTasks(
    args: {
      masterEventId: number;
      follows: Array<any>;
      payloadBase: Record<string, any>;
    },
    qr?: QueryRunner
  ) {
    if (!args.follows?.length) return { queued: 0 };

    const manager = this.mgr(qr);

    const values = args.follows.map((f) => ({
      masterEventId: args.masterEventId,
      followId: Number(f.id),
      status: CopyTaskStatus.QUEUED,
      attempts: 0,
      lastError: null,
      payload: {
        ...args.payloadBase,
        follow: {
          id: Number(f.id),
          followerUserId: Number(f.followerUserId),
          followerTradingAccountId: Number(f.followerTradingAccountId),
          subscriptionId: f.subscriptionId ? Number(f.subscriptionId) : null,

          riskMode: f.riskMode,
          riskValue: f.riskValue,
          maxLot: f.maxLot,
          maxOpenPositions: f.maxOpenPositions,
          maxDailyLoss: f.maxDailyLoss,
          slippageTolerance: f.slippageTolerance,
          symbolWhitelist: f.symbolWhitelist,
          metadata: f.metadata,
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await manager
      .createQueryBuilder()
      .insert()
      .into(CopyTradeTask)
      .values(values as any)
      .execute();

    return { queued: values.length };
  }
}
