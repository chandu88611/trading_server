"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopyTradingService = void 0;
const constants_1 = require("../../../types/constants");
const copyTrading_db_1 = require("./copyTrading.db");
class CopyTradingService {
    constructor() {
        this.dbService = new copyTrading_db_1.CopyTradingDBService();
    }
    async getMyMaster(userId) {
        if (!userId)
            throw { status: constants_1.HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
        return this.dbService.getMyMaster(userId);
    }
    async upsertMyMaster(args) {
        if (!args.userId)
            throw { status: constants_1.HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
        if (!args.tradingAccountId)
            throw { status: constants_1.HttpStatusCode._BAD_REQUEST, message: "tradingAccountId_required" };
        return this.dbService.upsertMyMaster(args);
    }
    async listMasters(args) {
        return this.dbService.listMasters(args);
    }
    async followMaster(args) {
        if (!args.followerUserId)
            throw { status: constants_1.HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
        if (!args.masterId)
            throw { status: constants_1.HttpStatusCode._BAD_REQUEST, message: "masterId_required" };
        if (!args.followerTradingAccountId)
            throw { status: constants_1.HttpStatusCode._BAD_REQUEST, message: "followerTradingAccountId_required" };
        return this.dbService.followMaster(args);
    }
    async listMyFollows(args) {
        if (!args.followerUserId)
            throw { status: constants_1.HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
        return this.dbService.listMyFollows(args);
    }
    async updateMyFollow(args) {
        if (!args.followerUserId)
            throw { status: constants_1.HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
        const status = args.status;
        return this.dbService.updateMyFollow({ ...args, status });
    }
    async listMyFollowers(args) {
        if (!args.ownerUserId)
            throw { status: constants_1.HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
        return this.dbService.listMyFollowers(args);
    }
    async decideFollowerRequest(args) {
        if (!args.ownerUserId)
            throw { status: constants_1.HttpStatusCode._UNAUTHORISED, message: "unauthorized" };
        return this.dbService.decideFollowerRequest(args);
    }
}
exports.CopyTradingService = CopyTradingService;
