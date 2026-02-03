"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopyTradingDBService = void 0;
const data_source_1 = __importDefault(require("../../../db/data-source"));
const constants_1 = require("../../../types/constants");
const subscriberPlan_enum_1 = require("../../subscriptionPlan/enums/subscriberPlan.enum");
const CopyTradingMaster_1 = require("../../../entity/CopyTradingMaster");
const CopyTradingFollow_1 = require("../../../entity/CopyTradingFollow");
const CopyMasterEvent_1 = require("../../../entity/CopyMasterEvent");
const CopyTradeTask_1 = require("../../../entity/CopyTradeTask");
const UserTradingAccount_1 = require("../../../entity/UserTradingAccount");
class CopyTradingDBService {
    mgr(qr) {
        return qr ? qr.manager : data_source_1.default.manager;
    }
    // ---------------------------
    // helpers
    // ---------------------------
    async assertVerifiedAccountOwnedByUser(args) {
        const manager = this.mgr(args.qr);
        const acc = await manager
            .getRepository(UserTradingAccount_1.UserTradingAccount)
            .createQueryBuilder("ta")
            .leftJoin("ta.user", "u")
            .where("ta.id = :id", { id: args.tradingAccountId })
            .andWhere("u.id = :userId", { userId: args.userId })
            .andWhere("ta.status = :st", { st: subscriberPlan_enum_1.TradingAccountStatus.VERIFIED })
            .getOne();
        if (!acc) {
            throw {
                status: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "trading_account_not_verified_or_not_owned",
            };
        }
        return acc;
    }
    async getMasterById(masterId, qr) {
        const manager = this.mgr(qr);
        const master = await manager
            .getRepository(CopyTradingMaster_1.CopyTradingMaster)
            .createQueryBuilder("m")
            .where("m.id = :id", { id: masterId })
            .andWhere("m.deletedAt IS NULL")
            .getOne();
        if (!master) {
            throw { status: constants_1.HttpStatusCode._NOT_FOUND, message: "master_not_found" };
        }
        if (!master.isActive) {
            throw { status: constants_1.HttpStatusCode._BAD_REQUEST, message: "master_inactive" };
        }
        return master;
    }
    // ---------------------------
    // MASTER
    // ---------------------------
    async getMyMaster(userId) {
        try {
            return this.getOrCreateDefaultMasterForUser(userId);
        }
        catch (error) {
            throw error;
        }
    }
    async upsertMyMaster(args, qr) {
        const manager = this.mgr(qr);
        const acc = await this.assertVerifiedAccountOwnedByUser({
            userId: args.userId,
            tradingAccountId: args.tradingAccountId,
            qr,
        });
        const repo = manager.getRepository(CopyTradingMaster_1.CopyTradingMaster);
        // existing master
        const existing = await repo
            .createQueryBuilder("m")
            .where("m.ownerUserId = :userId", { userId: args.userId })
            .andWhere("m.sourceType = :st", {
            st: CopyTradingMaster_1.CopyMasterSourceType.TRADING_ACCOUNT,
        })
            .andWhere("m.deletedAt IS NULL")
            .orderBy("m.updatedAt", "DESC")
            .getOne();
        if (!existing) {
            const data = {
                ownerUserId: args.userId,
                sourceType: CopyTradingMaster_1.CopyMasterSourceType.TRADING_ACCOUNT,
                sourceTradingAccountId: acc.id,
                name: args.name ?? `Master-${args.userId}`,
                description: args.description ?? null,
                visibility: (args.visibility ?? "private"),
                requiresApproval: Boolean(args.requiresApproval),
                isActive: true,
                metadata: {},
            };
            const created = repo.create(data);
            const saved = await repo.save(created);
            return saved;
        }
        // update existing
        existing.sourceTradingAccountId = acc.id;
        if (args.name !== undefined)
            existing.name = args.name;
        if (args.description !== undefined)
            existing.description = args.description;
        if (args.visibility !== undefined)
            existing.visibility = args.visibility;
        if (args.requiresApproval !== undefined)
            existing.requiresApproval = Boolean(args.requiresApproval);
        const saved = await repo.save(existing);
        return saved;
    }
    async listMasters(args) {
        const manager = this.mgr(undefined);
        const page = Math.max(1, Number(args.page || 1));
        const limit = Math.min(100, Math.max(1, Number(args.limit || 20)));
        const offset = (page - 1) * limit;
        const visibility = args.visibility || "public";
        const qb = manager
            .getRepository(CopyTradingMaster_1.CopyTradingMaster)
            .createQueryBuilder("m")
            .where("m.deletedAt IS NULL")
            .andWhere("m.isActive = TRUE");
        // privacy rules
        if (args.viewerUserId) {
            qb.andWhere("(m.visibility != 'private' OR m.ownerUserId = :viewer)", {
                viewer: args.viewerUserId,
            });
        }
        else {
            qb.andWhere("m.visibility != 'private'");
        }
        if (visibility)
            qb.andWhere("m.visibility = :v", { v: visibility });
        const total = await qb.clone().getCount();
        const rows = await qb
            .clone()
            .select([
            "m.id as id",
            "m.ownerUserId as ownerUserId",
            "m.sourceType as sourceType",
            "m.sourceTradingAccountId as sourceTradingAccountId",
            "m.sourceStrategyId as sourceStrategyId",
            "m.name as name",
            "m.description as description",
            "m.visibility as visibility",
            "m.requiresApproval as requiresApproval",
            "m.isActive as isActive",
            "m.createdAt as createdAt",
            "m.updatedAt as updatedAt",
        ])
            .orderBy("m.updatedAt", "DESC")
            .offset(offset)
            .limit(limit)
            .getRawMany();
        return { page, limit, total, rows };
    }
    /**
     * Keep your existing function, used by fanout.
     */
    async getOrCreateDefaultMasterForUser(userId, qr) {
        try {
            const manager = this.mgr(qr);
            const existing = await manager
                .getRepository(CopyTradingMaster_1.CopyTradingMaster)
                .createQueryBuilder("m")
                .where("m.ownerUserId = :userId", { userId })
                .andWhere("m.sourceType = :st", {
                st: CopyTradingMaster_1.CopyMasterSourceType.TRADING_ACCOUNT,
            })
                .andWhere("m.deletedAt IS NULL")
                .orderBy("m.updatedAt", "DESC")
                .getOne();
            if (existing)
                return existing;
            const acc = await manager
                .getRepository(UserTradingAccount_1.UserTradingAccount)
                .createQueryBuilder("ta")
                .leftJoin("ta.user", "u")
                .where("u.id = :userId", { userId })
                .andWhere("ta.status = :st", { st: subscriberPlan_enum_1.TradingAccountStatus.VERIFIED })
                .orderBy("ta.lastVerifiedAt", "DESC")
                .addOrderBy("ta.createdAt", "DESC")
                .getOne();
            if (!acc) {
                throw {
                    status: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "no_verified_trading_account_for_master",
                };
            }
            const masterRepo = manager.getRepository(CopyTradingMaster_1.CopyTradingMaster);
            const data = {
                ownerUserId: userId,
                sourceType: CopyTradingMaster_1.CopyMasterSourceType.TRADING_ACCOUNT,
                sourceTradingAccountId: acc.id,
                name: `Master-${userId}`,
                description: null,
                visibility: "private",
                requiresApproval: false,
                isActive: true,
                metadata: {},
            };
            const created = masterRepo.create(data);
            return await masterRepo.save(created);
        }
        catch (error) {
            throw error;
        }
    }
    // ---------------------------
    // FOLLOW
    // ---------------------------
    async followMaster(args, qr) {
        const manager = this.mgr(qr);
        const master = await this.getMasterById(args.masterId, qr);
        // if master is private and not owner -> block
        if (String(master.visibility) === "private" &&
            Number(master.ownerUserId) !== args.followerUserId) {
            throw { status: constants_1.HttpStatusCode._BAD_REQUEST, message: "master_private" };
        }
        // follower account must be verified + owned
        await this.assertVerifiedAccountOwnedByUser({
            userId: args.followerUserId,
            tradingAccountId: args.followerTradingAccountId,
            qr,
        });
        const followRepo = manager.getRepository(CopyTradingFollow_1.CopyTradingFollow);
        // If requires approval and follower is not the owner => pending else active
        const initialStatus = master.requiresApproval &&
            Number(master.ownerUserId) !== args.followerUserId
            ? CopyTradingFollow_1.CopyFollowStatus.PENDING
            : CopyTradingFollow_1.CopyFollowStatus.ACTIVE;
        // upsert pattern
        const existing = await followRepo
            .createQueryBuilder("f")
            .where("f.masterId = :mid", { mid: args.masterId })
            .andWhere("f.followerTradingAccountId = :ta", {
            ta: args.followerTradingAccountId,
        })
            .getOne();
        if (!existing) {
            const data = {
                masterId: args.masterId,
                followerUserId: args.followerUserId,
                followerTradingAccountId: args.followerTradingAccountId,
                subscriptionId: args.subscriptionId
                    ? args.subscriptionId
                    : null,
                status: initialStatus,
                riskMode: args.riskMode ?? undefined,
                riskValue: args.riskValue ?? undefined,
                maxLot: args.maxLot ?? null,
                maxOpenPositions: args.maxOpenPositions ?? null,
                maxDailyLoss: args.maxDailyLoss ?? null,
                slippageTolerance: args.slippageTolerance ?? null,
                symbolWhitelist: args.symbolWhitelist ?? null,
                metadata: {},
                approvedAt: initialStatus === CopyTradingFollow_1.CopyFollowStatus.ACTIVE ? new Date() : null,
                requestedAt: new Date(),
            };
            const created = followRepo.create(data);
            const saved = await followRepo.save(created);
            return { status: saved.status, follow: saved };
        }
        // update risk settings; do not auto-approve if pending
        if (args.subscriptionId !== undefined)
            existing.subscriptionId = args.subscriptionId;
        if (args.riskMode !== undefined)
            existing.riskMode = args.riskMode;
        if (args.riskValue !== undefined)
            existing.riskValue = args.riskValue;
        if (args.maxLot !== undefined)
            existing.maxLot = args.maxLot;
        if (args.maxOpenPositions !== undefined)
            existing.maxOpenPositions = args.maxOpenPositions;
        if (args.maxDailyLoss !== undefined)
            existing.maxDailyLoss = args.maxDailyLoss;
        if (args.slippageTolerance !== undefined)
            existing.slippageTolerance = args.slippageTolerance;
        if (args.symbolWhitelist !== undefined)
            existing.symbolWhitelist = args.symbolWhitelist;
        // if it was stopped/rejected, allow re-request:
        if ([CopyTradingFollow_1.CopyFollowStatus.STOPPED, CopyTradingFollow_1.CopyFollowStatus.REJECTED].includes(existing.status)) {
            existing.status = initialStatus;
            existing.requestedAt = new Date();
            existing.stoppedAt = null;
            existing.pausedAt = null;
            existing.approvedAt =
                initialStatus === CopyTradingFollow_1.CopyFollowStatus.ACTIVE ? new Date() : null;
        }
        const saved = await followRepo.save(existing);
        return { status: saved.status, follow: saved };
    }
    async listMyFollows(args) {
        const manager = this.mgr(undefined);
        const page = Math.max(1, Number(args.page || 1));
        const limit = Math.min(100, Math.max(1, Number(args.limit || 20)));
        const offset = (page - 1) * limit;
        const base = manager
            .createQueryBuilder()
            .from("copy_trading_follows", "f")
            .innerJoin("copy_trading_masters", "m", "m.id = f.master_id")
            .where("f.follower_user_id = :uid", { uid: args.followerUserId });
        if (args.status)
            base.andWhere("f.status = :st", { st: args.status });
        const totalRow = await base
            .clone()
            .select("COUNT(*)::int", "total")
            .getRawOne();
        const total = Number(totalRow?.total ?? 0);
        const rows = await base
            .clone()
            .select([
            "f.id as id",
            "f.master_id as masterId",
            "f.follower_trading_account_id as followerTradingAccountId",
            "f.subscription_id as subscriptionId",
            "f.status as status",
            "f.risk_mode as riskMode",
            "f.risk_value as riskValue",
            "f.max_lot as maxLot",
            "f.max_open_positions as maxOpenPositions",
            "f.max_daily_loss as maxDailyLoss",
            "f.slippage_tolerance as slippageTolerance",
            "f.symbol_whitelist as symbolWhitelist",
            "f.created_at as createdAt",
            "f.updated_at as updatedAt",
            "m.name as masterName",
            "m.visibility as masterVisibility",
            "m.requires_approval as masterRequiresApproval",
            "m.owner_user_id as masterOwnerUserId",
        ])
            .orderBy("f.updated_at", "DESC")
            .offset(offset)
            .limit(limit)
            .getRawMany();
        return { page, limit, total, rows };
    }
    async updateMyFollow(args, qr) {
        const manager = this.mgr(qr);
        const followRepo = manager.getRepository(CopyTradingFollow_1.CopyTradingFollow);
        const follow = await followRepo
            .createQueryBuilder("f")
            .where("f.id = :id", { id: args.followId })
            .andWhere("f.followerUserId = :uid", { uid: args.followerUserId })
            .getOne();
        if (!follow)
            throw { status: constants_1.HttpStatusCode._NOT_FOUND, message: "follow_not_found" };
        // risk updates
        if (args.riskMode !== undefined)
            follow.riskMode = args.riskMode;
        if (args.riskValue !== undefined)
            follow.riskValue = args.riskValue;
        if (args.maxLot !== undefined)
            follow.maxLot = args.maxLot;
        if (args.maxOpenPositions !== undefined)
            follow.maxOpenPositions = args.maxOpenPositions;
        if (args.maxDailyLoss !== undefined)
            follow.maxDailyLoss = args.maxDailyLoss;
        if (args.slippageTolerance !== undefined)
            follow.slippageTolerance = args.slippageTolerance;
        if (args.symbolWhitelist !== undefined)
            follow.symbolWhitelist = args.symbolWhitelist;
        // status transitions
        if (args.status) {
            const s = String(args.status);
            if (!["active", "paused", "stopped", "pending"].includes(s)) {
                throw {
                    status: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "invalid_follow_status",
                };
            }
            follow.status = s;
            if (s === "paused")
                follow.pausedAt = new Date();
            if (s === "active")
                follow.pausedAt = null;
            if (s === "stopped")
                follow.stoppedAt = new Date();
        }
        const saved = await followRepo.save(follow);
        return saved;
    }
    async listMyFollowers(args) {
        const manager = this.mgr(undefined);
        const page = Math.max(1, Number(args.page || 1));
        const limit = Math.min(100, Math.max(1, Number(args.limit || 20)));
        const offset = (page - 1) * limit;
        const base = manager
            .createQueryBuilder()
            .from("copy_trading_follows", "f")
            .innerJoin("copy_trading_masters", "m", "m.id = f.master_id")
            .innerJoin("users", "u", "u.id = f.follower_user_id")
            .where("m.owner_user_id = :oid", { oid: args.ownerUserId })
            .andWhere("m.deleted_at IS NULL");
        if (args.status)
            base.andWhere("f.status = :st", { st: args.status });
        const totalRow = await base
            .clone()
            .select("COUNT(*)::int", "total")
            .getRawOne();
        const total = Number(totalRow?.total ?? 0);
        const rows = await base
            .clone()
            .select([
            "f.id as followId",
            "f.status as status",
            "f.follower_user_id as followerUserId",
            "f.follower_trading_account_id as followerTradingAccountId",
            "f.requested_at as requestedAt",
            "f.approved_at as approvedAt",
            "f.created_at as createdAt",
            "m.id as masterId",
            "m.name as masterName",
            "m.requires_approval as requiresApproval",
            "u.email as followerEmail",
            "u.name as followerName",
        ])
            .orderBy("f.updated_at", "DESC")
            .offset(offset)
            .limit(limit)
            .getRawMany();
        return { page, limit, total, rows };
    }
    async decideFollowerRequest(args, qr) {
        const manager = this.mgr(qr);
        // Ensure owner owns the master linked to this follow
        const row = await manager
            .createQueryBuilder()
            .from("copy_trading_follows", "f")
            .innerJoin("copy_trading_masters", "m", "m.id = f.master_id")
            .select([
            "f.id as id",
            "f.status as status",
            "m.owner_user_id as ownerUserId",
        ])
            .where("f.id = :fid", { fid: args.followId })
            .andWhere("m.owner_user_id = :oid", { oid: args.ownerUserId })
            .getRawOne();
        if (!row)
            throw { status: constants_1.HttpStatusCode._NOT_FOUND, message: "follow_not_found" };
        const newStatus = args.action === "approve" ? "active" : "rejected";
        await manager
            .createQueryBuilder()
            .update("copy_trading_follows")
            .set({
            status: newStatus,
            approved_at: args.action === "approve" ? () => "now()" : null,
            stopped_at: args.action === "reject" ? () => "now()" : null,
            updated_at: () => "now()",
        })
            .where("id = :id", { id: args.followId })
            .execute();
        return { followId: args.followId, status: newStatus };
    }
    // ---------------------------
    // EXISTING: EVENTS + FANOUT
    // ---------------------------
    async createMasterEvent(args, qr) {
        const manager = this.mgr(qr);
        const repo = manager.getRepository(CopyMasterEvent_1.CopyMasterEvent);
        const data = {
            masterId: args.masterId,
            eventType: args.eventType,
            symbol: args.symbol,
            side: args.side ?? null,
            price: args.price !== undefined && args.price !== null
                ? String(args.price)
                : null,
            signalTime: args.signalTime,
            masterOrderRef: args.masterOrderRef ?? null,
            masterPositionRef: null,
            payload: args.payload ?? {},
        };
        const ev = repo.create(data);
        return await repo.save(ev);
    }
    async getEligibleFollows(masterId, symbol, qr) {
        const manager = this.mgr(qr);
        return await manager
            .createQueryBuilder()
            .from("copy_trading_follows", "f")
            .innerJoin("users", "u", "u.id = f.follower_user_id")
            .innerJoin("user_trading_accounts", "ta", "ta.id = f.follower_trading_account_id")
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
            .andWhere("f.status = :status", { status: CopyTradingFollow_1.CopyFollowStatus.ACTIVE })
            .andWhere("u.is_active = TRUE")
            .andWhere("COALESCE(u.allow_trade, TRUE) = TRUE")
            .andWhere("COALESCE(u.allow_copy_trade, TRUE) = TRUE")
            .andWhere("ta.status = :taStatus", {
            taStatus: subscriberPlan_enum_1.TradingAccountStatus.VERIFIED,
        })
            .andWhere("(f.symbol_whitelist IS NULL OR :symbol = ANY(f.symbol_whitelist))", { symbol })
            .getRawMany();
    }
    async enqueueTasks(args, qr) {
        if (!args.follows?.length)
            return { queued: 0 };
        const manager = this.mgr(qr);
        const values = args.follows.map((f) => ({
            masterEventId: args.masterEventId,
            followId: Number(f.id),
            status: CopyTradeTask_1.CopyTaskStatus.QUEUED,
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
            .into(CopyTradeTask_1.CopyTradeTask)
            .values(values)
            .execute();
        return { queued: values.length };
    }
}
exports.CopyTradingDBService = CopyTradingDBService;
