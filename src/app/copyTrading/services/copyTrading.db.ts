import AppDataSource from "../../../db/data-source";
import { QueryRunner } from "typeorm";
import { CopyTradingMaster } from "../../../entity/CopyTradingMaster";
import { CopyTradingFollowers, CopyFollowStatus } from "../../../entity/CopyTradingFollow";
import { UserTradingAccount } from "../../../entity/UserTradingAccount";

export class CopyTradingDBService {
  private mgr(qr?: QueryRunner) {
    return qr ? qr.manager : AppDataSource.manager;
  }

  // ─────────────────────────────────────────────
  // MASTER
  // ─────────────────────────────────────────────

  async getMyMaster(userId: number): Promise<CopyTradingMaster | null> {
    const master = await AppDataSource.manager
      .createQueryBuilder(CopyTradingMaster, "m")
      .innerJoin(UserTradingAccount, "uta", "uta.id = m.userTradingAccountId")
      .where("uta.userId = :userId", { userId })
      .andWhere("m.deletedAt IS NULL")
      .orderBy("m.createdAt", "DESC")
      .getOne();
    return master ?? null;
  }

  async upsertMyMaster(args: {
    userId: number;
    tradingAccountId: number;
    isActive?: boolean;
  }, qr?: QueryRunner): Promise<CopyTradingMaster> {
    const manager = this.mgr(qr);

    const account = await manager.findOne(UserTradingAccount, {
      where: { id: args.tradingAccountId, userId: args.userId } as any,
    });
    if (!account) throw { status: 400, message: "trading_account_not_found_or_not_owned" };

    let master = await manager.findOne(CopyTradingMaster, {
      where: { userTradingAccountId: args.tradingAccountId } as any,
    });

    if (master) {
      master.isActive = args.isActive ?? master.isActive;
      return manager.save(master);
    }

    const newMaster = manager.create(CopyTradingMaster, {
      userTradingAccountId: args.tradingAccountId,
      masterTradingAccountId: args.tradingAccountId,
      isActive: args.isActive ?? true,
    });
    return manager.save(newMaster);
  }

  async listMasters(args: {
    page: number;
    limit: number;
  }): Promise<{ rows: CopyTradingMaster[]; total: number; page: number; limit: number }> {
    const { page, limit } = args;
    const [rows, total] = await AppDataSource.manager.findAndCount(CopyTradingMaster, {
      where: { isActive: true } as any,
      order: { createdAt: "DESC" } as any,
      skip: (page - 1) * limit,
      take: limit,
      relations: ["userTradingAccount"],
    });
    return { rows, total, page, limit };
  }

  // ─────────────────────────────────────────────
  // FOLLOWS
  // ─────────────────────────────────────────────

  async followMaster(args: {
    masterId: number;
    followerUserId: number;
    followerTradingAccountId: number;
  }, qr?: QueryRunner): Promise<CopyTradingFollowers> {
    const manager = this.mgr(qr);

    const existing = await manager.findOne(CopyTradingFollowers, {
      where: {
        masterId: args.masterId,
        followerUserId: args.followerUserId,
        followerTradingAccountId: args.followerTradingAccountId,
      } as any,
    });

    if (existing) {
      existing.status = CopyFollowStatus.ACTIVE;
      existing.approvedAt = new Date();
      return manager.save(existing);
    }

    const follow = manager.create(CopyTradingFollowers, {
      masterId: args.masterId,
      followerUserId: args.followerUserId,
      followerTradingAccountId: args.followerTradingAccountId,
      status: CopyFollowStatus.ACTIVE,
      requestedAt: new Date(),
      approvedAt: new Date(),
    });
    return manager.save(follow);
  }

  async listMyFollows(args: {
    followerUserId: number;
    page: number;
    limit: number;
    status?: string;
  }): Promise<{ rows: CopyTradingFollowers[]; total: number; page: number; limit: number }> {
    const { followerUserId, page, limit, status } = args;
    const where: any = { followerUserId };
    if (status) where.status = status;

    const [rows, total] = await AppDataSource.manager.findAndCount(CopyTradingFollowers, {
      where,
      order: { createdAt: "DESC" } as any,
      skip: (page - 1) * limit,
      take: limit,
    });
    return { rows, total, page, limit };
  }

  async updateMyFollow(args: {
    followId: number;
    followerUserId: number;
    status?: CopyFollowStatus;
  }, qr?: QueryRunner): Promise<CopyTradingFollowers> {
    const manager = this.mgr(qr);

    const follow = await manager.findOne(CopyTradingFollowers, {
      where: { id: args.followId, followerUserId: args.followerUserId } as any,
    });
    if (!follow) throw { status: 404, message: "follow_not_found" };

    if (args.status) {
      follow.status = args.status;
      if (args.status === CopyFollowStatus.PAUSED) follow.pausedAt = new Date();
      if (args.status === CopyFollowStatus.STOPPED) follow.stoppedAt = new Date();
    }

    return manager.save(follow);
  }

  async listMyFollowers(args: {
    ownerUserId: number;
    page: number;
    limit: number;
    status?: string;
  }): Promise<{ rows: CopyTradingFollowers[]; total: number; page: number; limit: number }> {
    const { ownerUserId, page, limit, status } = args;

    const qb = AppDataSource.manager
      .createQueryBuilder(CopyTradingFollowers, "f")
      .innerJoin(UserTradingAccount, "uta", "uta.id = f.masterId")
      .where("uta.userId = :ownerUserId", { ownerUserId });

    if (status) qb.andWhere("f.status = :status", { status });

    qb.orderBy("f.createdAt", "DESC").skip((page - 1) * limit).take(limit);

    const [rows, total] = await qb.getManyAndCount();
    return { rows, total, page, limit };
  }

  async decideFollowerRequest(args: {
    ownerUserId: number;
    followId: number;
    action: "approve" | "reject";
  }): Promise<{ followId: number; status: string }> {
    const follow = await AppDataSource.manager
      .createQueryBuilder(CopyTradingFollowers, "f")
      .innerJoin(UserTradingAccount, "uta", "uta.id = f.masterId")
      .where("f.id = :fid", { fid: args.followId })
      .andWhere("uta.userId = :oid", { oid: args.ownerUserId })
      .getOne();

    if (!follow) throw { status: 404, message: "follow_not_found" };

    follow.status = args.action === "approve" ? CopyFollowStatus.ACTIVE : CopyFollowStatus.REJECTED;
    if (args.action === "approve") follow.approvedAt = new Date();
    if (args.action === "reject") follow.stoppedAt = new Date();

    await AppDataSource.manager.save(follow);
    return { followId: args.followId, status: follow.status };
  }

  async getEligibleFollows(masterId: number): Promise<CopyTradingFollowers[]> {
    return AppDataSource.manager.find(CopyTradingFollowers, {
      where: { masterId, status: CopyFollowStatus.ACTIVE } as any,
      relations: ["followerTradingAccount"],
    });
  }
}
