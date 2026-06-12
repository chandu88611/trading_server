"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopyTradingDBService = void 0;
const data_source_1 = __importDefault(require("../../../db/data-source"));
const CopyTradingMaster_1 = require("../../../entity/CopyTradingMaster");
const CopyTradingFollow_1 = require("../../../entity/CopyTradingFollow");
const UserTradingAccount_1 = require("../../../entity/UserTradingAccount");
class CopyTradingDBService {
    mgr(qr) {
        return qr ? qr.manager : data_source_1.default.manager;
    }
    // ─────────────────────────────────────────────
    // MASTER
    // ─────────────────────────────────────────────
    async getMyMaster(userId) {
        const master = await data_source_1.default.manager
            .createQueryBuilder(CopyTradingMaster_1.CopyTradingMaster, "m")
            .innerJoin(UserTradingAccount_1.UserTradingAccount, "uta", "uta.id = m.userTradingAccountId")
            .where("uta.userId = :userId", { userId })
            .andWhere("m.deletedAt IS NULL")
            .orderBy("m.createdAt", "DESC")
            .getOne();
        return master ?? null;
    }
    async upsertMyMaster(args, qr) {
        const manager = this.mgr(qr);
        const account = await manager.findOne(UserTradingAccount_1.UserTradingAccount, {
            where: { id: args.tradingAccountId, userId: args.userId },
        });
        if (!account)
            throw { status: 400, message: "trading_account_not_found_or_not_owned" };
        let master = await manager.findOne(CopyTradingMaster_1.CopyTradingMaster, {
            where: { userTradingAccountId: args.tradingAccountId },
        });
        if (master) {
            master.isActive = args.isActive ?? master.isActive;
            return manager.save(master);
        }
        const newMaster = manager.create(CopyTradingMaster_1.CopyTradingMaster, {
            userTradingAccountId: args.tradingAccountId,
            masterTradingAccountId: args.tradingAccountId,
            isActive: args.isActive ?? true,
        });
        return manager.save(newMaster);
    }
    async listMasters(args) {
        const { page, limit } = args;
        const [rows, total] = await data_source_1.default.manager.findAndCount(CopyTradingMaster_1.CopyTradingMaster, {
            where: { isActive: true },
            order: { createdAt: "DESC" },
            skip: (page - 1) * limit,
            take: limit,
            relations: ["userTradingAccount"],
        });
        return { rows, total, page, limit };
    }
    // ─────────────────────────────────────────────
    // FOLLOWS
    // ─────────────────────────────────────────────
    async followMaster(args, qr) {
        const manager = this.mgr(qr);
        const existing = await manager.findOne(CopyTradingFollow_1.CopyTradingFollowers, {
            where: {
                masterId: args.masterId,
                followerUserId: args.followerUserId,
                followerTradingAccountId: args.followerTradingAccountId,
            },
        });
        if (existing) {
            existing.status = CopyTradingFollow_1.CopyFollowStatus.ACTIVE;
            existing.approvedAt = new Date();
            return manager.save(existing);
        }
        const follow = manager.create(CopyTradingFollow_1.CopyTradingFollowers, {
            masterId: args.masterId,
            followerUserId: args.followerUserId,
            followerTradingAccountId: args.followerTradingAccountId,
            status: CopyTradingFollow_1.CopyFollowStatus.ACTIVE,
            requestedAt: new Date(),
            approvedAt: new Date(),
        });
        return manager.save(follow);
    }
    async listMyFollows(args) {
        const { followerUserId, page, limit, status } = args;
        const where = { followerUserId };
        if (status)
            where.status = status;
        const [rows, total] = await data_source_1.default.manager.findAndCount(CopyTradingFollow_1.CopyTradingFollowers, {
            where,
            order: { createdAt: "DESC" },
            skip: (page - 1) * limit,
            take: limit,
        });
        return { rows, total, page, limit };
    }
    async updateMyFollow(args, qr) {
        const manager = this.mgr(qr);
        const follow = await manager.findOne(CopyTradingFollow_1.CopyTradingFollowers, {
            where: { id: args.followId, followerUserId: args.followerUserId },
        });
        if (!follow)
            throw { status: 404, message: "follow_not_found" };
        if (args.status) {
            follow.status = args.status;
            if (args.status === CopyTradingFollow_1.CopyFollowStatus.PAUSED)
                follow.pausedAt = new Date();
            if (args.status === CopyTradingFollow_1.CopyFollowStatus.STOPPED)
                follow.stoppedAt = new Date();
        }
        return manager.save(follow);
    }
    async listMyFollowers(args) {
        const { ownerUserId, page, limit, status } = args;
        const qb = data_source_1.default.manager
            .createQueryBuilder(CopyTradingFollow_1.CopyTradingFollowers, "f")
            .innerJoin(UserTradingAccount_1.UserTradingAccount, "uta", "uta.id = f.masterId")
            .where("uta.userId = :ownerUserId", { ownerUserId });
        if (status)
            qb.andWhere("f.status = :status", { status });
        qb.orderBy("f.createdAt", "DESC").skip((page - 1) * limit).take(limit);
        const [rows, total] = await qb.getManyAndCount();
        return { rows, total, page, limit };
    }
    async decideFollowerRequest(args) {
        const follow = await data_source_1.default.manager
            .createQueryBuilder(CopyTradingFollow_1.CopyTradingFollowers, "f")
            .innerJoin(UserTradingAccount_1.UserTradingAccount, "uta", "uta.id = f.masterId")
            .where("f.id = :fid", { fid: args.followId })
            .andWhere("uta.userId = :oid", { oid: args.ownerUserId })
            .getOne();
        if (!follow)
            throw { status: 404, message: "follow_not_found" };
        follow.status = args.action === "approve" ? CopyTradingFollow_1.CopyFollowStatus.ACTIVE : CopyTradingFollow_1.CopyFollowStatus.REJECTED;
        if (args.action === "approve")
            follow.approvedAt = new Date();
        if (args.action === "reject")
            follow.stoppedAt = new Date();
        await data_source_1.default.manager.save(follow);
        return { followId: args.followId, status: follow.status };
    }
    async getEligibleFollows(masterId) {
        return data_source_1.default.manager.find(CopyTradingFollow_1.CopyTradingFollowers, {
            where: { masterId, status: CopyTradingFollow_1.CopyFollowStatus.ACTIVE },
            relations: ["followerTradingAccount"],
        });
    }
}
exports.CopyTradingDBService = CopyTradingDBService;
