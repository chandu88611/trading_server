"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CTradeSignalDB = void 0;
const data_source_1 = __importDefault(require("../../../db/data-source"));
const entity_1 = require("../../../entity");
const trade_identify_1 = require("../../../types/trade-identify");
const CTradeSignals_1 = require("../../../entity/CTradeSignals");
class CTradeSignalDB {
    constructor() {
        this.repo = data_source_1.default.getRepository(CTradeSignals_1.CTradeSignal);
        this.repoStatus = data_source_1.default.getRepository(CTradeSignals_1.CTradeSignalStatus);
        this.jobRepo = data_source_1.default.getRepository(entity_1.BrokerJob);
    }
    async createTradeSignal(alertData, queryRunner) {
        const entity = queryRunner.manager.getRepository(CTradeSignals_1.CTradeSignal).create({
            jobId: alertData.jobId,
            action: alertData.action,
            symbol: alertData.symbol,
            price: alertData.price,
            exchange: alertData.exchange,
            signalTime: alertData.signalTime,
            assetType: trade_identify_1.AssetClassifier.detect({
                symbol: alertData.symbol,
                exchange: alertData.exchange,
            }),
        });
        const saved = await queryRunner.manager.getRepository(CTradeSignals_1.CTradeSignal).save(entity);
        const statusEntity = queryRunner.manager.getRepository(CTradeSignals_1.CTradeSignalStatus).create({
            tradeSignalId: saved.id,
            status: "pending",
        });
        await queryRunner.manager.getRepository(CTradeSignals_1.CTradeSignalStatus).save(statusEntity);
        return saved;
    }
    async create(payload) {
        const job = await this.jobRepo.findOne({ where: { id: payload.jobId } });
        if (!job)
            throw new Error("job_not_found");
        const entity = this.repo.create({
            brokerJob: { id: payload.jobId },
            action: payload.action,
            symbol: payload.symbol,
            price: payload.price,
            exchange: payload.exchange,
            signalTime: payload.signalTime,
        });
        return this.repo.save(entity);
    }
    async listByJob(jobId) {
        return this.repo.find({
            where: { brokerJob: { id: jobId } },
            order: { createdAt: "DESC" },
        });
    }
    async getAllTradeTo({ start, count }) {
        const data = await this.repo
            .createQueryBuilder("cts")
            .innerJoinAndSelect(CTradeSignals_1.CTradeSignalStatus, "ctss", "cts.id = ctss.trade_signal_id")
            .where("ctss.status = :status", { status: "pending" })
            .skip(start)
            .take(count)
            .getMany();
        return data;
    }
    async claimPendingTrades(limit) {
        const qr = data_source_1.default.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        try {
            const statusRepo = qr.manager.getRepository(CTradeSignals_1.CTradeSignalStatus);
            // Select tradeSignalId rows from status table
            const qb = statusRepo
                .createQueryBuilder("s")
                .select("s.tradeSignalId", "id")
                .where("s.status = :status", { status: "pending" })
                .orderBy("s.tradeSignalId", "ASC")
                .limit(limit)
                .setLock("pessimistic_write");
            // TypeORM versions differ: setOnLocked may not exist in typings
            if (typeof qb.setOnLocked === "function")
                qb.setOnLocked("skip_locked");
            const rows = await qb.getRawMany();
            const ids = rows.map((r) => Number(r.id)).filter(Boolean);
            if (!ids.length) {
                await qr.commitTransaction();
                return [];
            }
            // Mark claimed -> processing
            await statusRepo
                .createQueryBuilder()
                .update(CTradeSignals_1.CTradeSignalStatus)
                .set({ status: "processing", updatedAt: new Date() })
                .where("tradeSignalId IN (:...ids)", { ids })
                .execute();
            // Fetch signals
            const signals = await qr.manager
                .getRepository(CTradeSignals_1.CTradeSignal)
                .createQueryBuilder("cts")
                .leftJoinAndSelect("cts.brokerJob", "bj")
                .leftJoinAndSelect("bj.credential", "bc")
                .where("cts.id IN (:...ids)", { ids })
                .andWhere("bc.keyName = :keyName", { keyName: "CT" })
                .getMany();
            console.log("Claimed trade signals:", signals);
            //   find({
            //     where: { id: In(ids) },
            //   });
            // keep order as ids
            const map = new Map(signals.map((s) => [s.id, s]));
            const ordered = ids.map((id) => map.get(id)).filter(Boolean);
            const badIds = [];
            const structured = [];
            for (const s of ordered) {
                const userId = s?.brokerJob?.credential?.brokerAccountId;
                if (!userId || !Number.isFinite(Number(userId))) {
                    badIds.push(s.id);
                    continue;
                }
                structured.push({
                    id: s.id,
                    jobId: Number(s.jobId),
                    action: String(s.action),
                    symbol: String(s.symbol),
                    price: String(s.price), // numeric -> string
                    exchange: String(s.exchange),
                    assetType: String(s.assetType),
                    signalTime: s.signalTime instanceof Date ? s.signalTime.toISOString() : new Date(s.signalTime).toISOString(),
                    userId: Number(userId),
                });
            }
            // 6) Any bad ones -> set status FAILED so they don’t keep getting re-claimed forever
            if (badIds.length) {
                await statusRepo
                    .createQueryBuilder()
                    .update(CTradeSignals_1.CTradeSignalStatus)
                    .set({ status: "FAILED", updatedAt: new Date() })
                    .where("tradeSignalId IN (:...ids)", { ids: badIds })
                    .execute();
            }
            await qr.commitTransaction();
            return structured;
        }
        catch (e) {
            await qr.rollbackTransaction();
            throw e;
        }
        finally {
            await qr.release();
        }
    }
    async updateTradeStatus(data) {
        await Promise.all(data.map(async (item) => {
            await this.repoStatus
                .createQueryBuilder()
                .update(CTradeSignals_1.CTradeSignalStatus)
                .set({ status: item.status, updatedAt: new Date() })
                .where("trade_signal_id = :id", { id: item.id })
                .execute();
        }));
    }
}
exports.CTradeSignalDB = CTradeSignalDB;
