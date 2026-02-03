"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopyTradingService = void 0;
const data_source_1 = __importDefault(require("../../../db/data-source"));
const constants_1 = require("../../../types/constants");
const copyTrading_db_1 = require("./copyTrading.db");
const CopyMasterEvent_1 = require("../../../entity/CopyMasterEvent");
function normalizeAction(action) {
    return String(action || "")
        .trim()
        .toUpperCase();
}
function mapToCopyEvent(action) {
    const a = normalizeAction(action);
    if (a === "BUY" || a === "LONG")
        return { eventType: CopyMasterEvent_1.CopyEventType.OPEN, side: CopyMasterEvent_1.CopyTradeSide.BUY };
    if (a === "SELL" || a === "SHORT")
        return { eventType: CopyMasterEvent_1.CopyEventType.OPEN, side: CopyMasterEvent_1.CopyTradeSide.SELL };
    if (a.includes("CLOSE"))
        return { eventType: CopyMasterEvent_1.CopyEventType.CLOSE, side: null };
    if (a.includes("MODIFY"))
        return { eventType: CopyMasterEvent_1.CopyEventType.MODIFY, side: null };
    if (a.includes("PARTIAL"))
        return { eventType: CopyMasterEvent_1.CopyEventType.PARTIAL_CLOSE, side: null };
    return { eventType: CopyMasterEvent_1.CopyEventType.OPEN, side: null };
}
class CopyTradingService {
    constructor() {
        this.dbService = new copyTrading_db_1.CopyTradingDBService();
    }
    // ---------------------------
    // READ APIs
    // ---------------------------
    async getMyMaster(userId) {
        try {
            if (!userId)
                throw { status: constants_1.HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
            return this.dbService.getMyMaster(userId);
        }
        catch (error) {
            throw error;
        }
    }
    async listMasters(args) {
        return this.dbService.listMasters(args);
    }
    async listMyFollows(args) {
        if (!args.followerUserId)
            throw { status: constants_1.HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
        return this.dbService.listMyFollows(args);
    }
    async listMyFollowers(args) {
        if (!args.ownerUserId)
            throw { status: constants_1.HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
        return this.dbService.listMyFollowers(args);
    }
    // ---------------------------
    // WRITE APIs (Transaction)
    // ---------------------------
    async upsertMyMaster(args) {
        if (!args.userId)
            throw { status: constants_1.HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
        if (!args.tradingAccountId)
            throw {
                status: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "tradingAccountId_required",
            };
        const qr = data_source_1.default.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        try {
            const out = await this.dbService.upsertMyMaster(args, qr);
            await qr.commitTransaction();
            return out;
        }
        catch (e) {
            await qr.rollbackTransaction();
            throw e;
        }
        finally {
            await qr.release();
        }
    }
    async followMaster(args) {
        if (!args.followerUserId)
            throw { status: constants_1.HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
        if (!args.masterId || !args.followerTradingAccountId) {
            throw {
                status: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "masterId_and_followerTradingAccountId_required",
            };
        }
        const qr = data_source_1.default.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        try {
            const out = await this.dbService.followMaster(args, qr);
            await qr.commitTransaction();
            return out;
        }
        catch (e) {
            await qr.rollbackTransaction();
            throw e;
        }
        finally {
            await qr.release();
        }
    }
    async updateMyFollow(args) {
        if (!args.followerUserId)
            throw { status: constants_1.HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
        if (!args.followId)
            throw {
                status: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "followId_required",
            };
        const qr = data_source_1.default.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        try {
            const out = await this.dbService.updateMyFollow(args, qr);
            await qr.commitTransaction();
            return out;
        }
        catch (e) {
            await qr.rollbackTransaction();
            throw e;
        }
        finally {
            await qr.release();
        }
    }
    async decideFollowerRequest(args) {
        if (!args.ownerUserId)
            throw { status: constants_1.HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
        if (!args.followId)
            throw {
                status: constants_1.HttpStatusCode._BAD_REQUEST,
                message: "followId_required",
            };
        const qr = data_source_1.default.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        try {
            const out = await this.dbService.decideFollowerRequest(args, qr);
            await qr.commitTransaction();
            return out;
        }
        catch (e) {
            await qr.rollbackTransaction();
            throw e;
        }
        finally {
            await qr.release();
        }
    }
    // ---------------------------
    // EXISTING: Master signal -> follower tasks
    // ---------------------------
    async fanoutFromMasterSignal(args, queryRunner) {
        const master = await this.dbService.getOrCreateDefaultMasterForUser(args.userId, queryRunner);
        const { eventType, side } = mapToCopyEvent(args.action);
        const masterOrderRef = `job:${args.brokerJobId}:alert:${args.alertSnapshotId}`;
        const masterEvent = await this.dbService.createMasterEvent({
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
        }, queryRunner);
        const follows = await this.dbService.getEligibleFollows(Number(master.id), args.symbol, queryRunner);
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
        const res = await this.dbService.enqueueTasks({ masterEventId: Number(masterEvent.id), follows, payloadBase }, queryRunner);
        return {
            masterId: master.id,
            masterEventId: masterEvent.id,
            queued: res.queued,
        };
    }
}
exports.CopyTradingService = CopyTradingService;
