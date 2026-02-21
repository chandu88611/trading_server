"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeDBService = void 0;
// src/app/trade/services/trade.db.ts
const data_source_1 = __importDefault(require("../../../db/data-source"));
const entity_1 = require("../../../entity");
const typeorm_1 = require("typeorm");
const constants_1 = require("../../../types/constants");
class TradeDBService {
    constructor() {
        this.snapshotRepo = data_source_1.default.getRepository(entity_1.AlertSnapshot);
        this.signalRepo = data_source_1.default.getRepository(entity_1.TradeSignal);
    }
    async getAllTradeForUser({ userId, accountId, start, count, searchParams, status }) {
        try {
            let data = await this.signalRepo.createQueryBuilder("ts")
                .leftJoinAndSelect("ts.tradingAccount", "ta")
                .leftJoinAndSelect("ts.status", "tss")
                .where("ta.userId = :userId", { userId })
                .andWhere("ta.id = :accountId", { accountId })
                .andWhere(new typeorm_1.Brackets(qb => {
                if (status) {
                    qb.where("tss.status = :status", { status });
                }
                else {
                    qb.where("tss.status IN (:...statuses)", { statuses: ["pending", "in_progress", "completed", "failed"] });
                }
            }))
                .orderBy("ts.createdAt", "DESC")
                .skip(start)
                .take(count);
            if (searchParams) {
                data = data.andWhere("ts.symbol ILIKE :searchParams", { searchParams: `%${searchParams}%` });
            }
            return await data.getMany();
        }
        catch (error) {
            throw {
                statusCode: constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR,
                message: "database_error_fetching_trades",
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async getSignalStatusForTrade(signalId) {
        try {
            const status = await this.signalRepo.createQueryBuilder("ts")
                .leftJoinAndSelect("ts.status", "tss")
                .leftJoinAndSelect("ts.tradingAccount", "ta")
                .where("ts.id = :signalId", { signalId })
                .getOne();
            if (!status) {
                throw {
                    statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "signal_status_not_found",
                };
            }
            return status;
        }
        catch (error) {
            throw error;
        }
    }
    async getHistoryForTrade({ userId, accountId, start, count, searchParams, status }) {
        try {
            let data = await this.signalRepo.createQueryBuilder("ts")
                .leftJoinAndSelect("ts.tradingAccount", "ta")
                .leftJoinAndSelect("ts.status", "tss")
                .where("ta.userId = :userId", { userId })
                .andWhere("ta.id = :accountId", { accountId })
                .andWhere(new typeorm_1.Brackets(qb => {
                qb.where("tss.status IN (:...statuses)", { statuses: ["closed", "pending_close"] });
            }))
                .orderBy("ts.createdAt", "DESC")
                .skip(start)
                .take(count);
            if (searchParams) {
                data = data.andWhere("ts.symbol ILIKE :searchParams", { searchParams: `%${searchParams}%` });
            }
            return await data.getMany();
        }
        catch (error) {
            throw error;
        }
    }
    async closeTrade(signalIds, userId, isCloseAll, queryRunner) {
        try {
            if (signalIds.length === 0 && !isCloseAll) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "missing_signal_ids",
                };
            }
            console.log("Closing trades with signalIds:", signalIds, "for userId:", userId, "isCloseAll:", isCloseAll);
            const signalQb = queryRunner.manager.getRepository(entity_1.TradeSignal).createQueryBuilder("ts")
                .leftJoin("ts.tradingAccount", "ta")
                .leftJoin("ts.status", "tss")
                .where("ta.userId = :userId", { userId })
                .andWhere("tss.status = :status", { status: "completed" });
            if (!isCloseAll) {
                signalQb.andWhere("ts.id IN (:...signalIds)", { signalIds });
            }
            const signalsToClose = await signalQb.getMany();
            if (signalsToClose.length === 0) {
                throw {
                    statusCode: constants_1.HttpStatusCode._NOT_FOUND,
                    message: "no_trades_found_to_close",
                };
            }
            let updateSignalStatus = await queryRunner.manager.getRepository(entity_1.TradeSignalStatus).createQueryBuilder()
                .update(entity_1.TradeSignalStatus)
                .set({ status: "pending_close" })
                .where("tradeSignalId IN (:...ids)", { ids: signalsToClose.map(s => s.id) })
                .execute();
            return {
                message: `${updateSignalStatus.affected} trade(s) closed successfully`,
            };
        }
        catch (error) {
            throw error;
        }
    }
}
exports.TradeDBService = TradeDBService;
