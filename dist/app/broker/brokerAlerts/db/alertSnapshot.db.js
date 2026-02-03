"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertSnapshotDB = void 0;
const data_source_1 = __importDefault(require("../../../../db/data-source"));
const AlertSnapshots_1 = require("../../../../entity/AlertSnapshots");
const entity_1 = require("../../../../entity");
const OPEN_STATUSES = ["pending", "running", "queued"];
class AlertSnapshotDB {
    constructor() {
        this.repo = data_source_1.default.getRepository(AlertSnapshots_1.AlertSnapshot);
        this.jobRepo = data_source_1.default.getRepository(entity_1.BrokerJob);
    }
    async create(payload, brokerJobId, queryRunner) {
        try {
            const entity = queryRunner.manager
                .getRepository(AlertSnapshots_1.AlertSnapshot)
                .create({
                brokerJob: { id: brokerJobId },
                ticker: payload.ticker,
                exchange: payload.exchange,
                interval: payload.interval,
                barTime: payload.barTime,
                alertTime: payload.alertTime,
                open: payload.open,
                close: payload.close,
                high: payload.high,
                low: payload.low,
                volume: payload.volume,
                currency: payload.currency ?? null,
                baseCurrency: payload.baseCurrency ?? null,
            });
            return await queryRunner.manager
                .getRepository(AlertSnapshots_1.AlertSnapshot)
                .save(entity);
        }
        catch (error) {
            throw error;
        }
    }
    async listByJob(jobId) {
        return this.repo.find({
            where: { brokerJob: { id: jobId } },
            order: { createdAt: "DESC" },
        });
    }
    async getHistory(q) {
        const offset = (q.page - 1) * q.limit;
        const base = data_source_1.default.createQueryBuilder()
            .from("alert_snapshots", "a")
            .innerJoin("broker_jobs", "j", "j.id = a.job_id")
            .innerJoin("broker_credentials", "c", "c.id = j.credential_id")
            .where("c.user_id = :userId", { userId: q.userId })
            .andWhere("a.created_at BETWEEN :from AND :to", {
            from: q.from,
            to: q.to,
        });
        if (q.jobId)
            base.andWhere("j.id = :jobId", { jobId: q.jobId });
        if (q.ticker)
            base.andWhere("a.ticker = :ticker", { ticker: q.ticker });
        if (q.exchange)
            base.andWhere("a.exchange = :exchange", { exchange: q.exchange });
        if (q.interval)
            base.andWhere("a.interval = :interval", { interval: q.interval });
        // total count
        const totalRow = await base
            .clone()
            .select("COUNT(*)::int", "total")
            .getRawOne();
        const total = Number(totalRow?.total ?? 0);
        // rows
        const rows = await base
            .clone()
            .select([
            "a.id as id",
            "a.job_id as jobId",
            "a.ticker as ticker",
            "a.exchange as exchange",
            "a.interval as interval",
            "a.bar_time as barTime",
            "a.alert_time as alertTime",
            "a.open as open",
            "a.close as close",
            "a.high as high",
            "a.low as low",
            "a.volume as volume",
            "a.currency as currency",
            "a.base_currency as baseCurrency",
            "a.created_at as createdAt",
        ])
            .orderBy("a.created_at", "DESC")
            .offset(offset)
            .limit(q.limit)
            .getRawMany();
        return {
            page: q.page,
            limit: q.limit,
            total,
            rows,
            from: q.from,
            to: q.to,
        };
    }
    async getTimeline(q) {
        const bucketExpr = this.bucketExpr("a.created_at", q.bucket);
        const qb = data_source_1.default.createQueryBuilder()
            .from("alert_snapshots", "a")
            .innerJoin("broker_jobs", "j", "j.id = a.job_id")
            .innerJoin("broker_credentials", "c", "c.id = j.credential_id")
            .select(`${bucketExpr}`, "bucket")
            .addSelect("COUNT(*)::int", "count")
            .addSelect("MIN(a.close)::numeric", "minClose")
            .addSelect("MAX(a.close)::numeric", "maxClose")
            .addSelect("AVG(a.close)::numeric", "avgClose")
            .addSelect("SUM(COALESCE(a.volume,0))::numeric", "volume")
            .where("c.user_id = :userId", { userId: q.userId })
            .andWhere("a.created_at BETWEEN :from AND :to", {
            from: q.from,
            to: q.to,
        });
        if (q.jobId)
            qb.andWhere("j.id = :jobId", { jobId: q.jobId });
        if (q.ticker)
            qb.andWhere("a.ticker = :ticker", { ticker: q.ticker });
        if (q.exchange)
            qb.andWhere("a.exchange = :exchange", { exchange: q.exchange });
        if (q.interval)
            qb.andWhere("a.interval = :interval", { interval: q.interval });
        const rows = await qb
            .groupBy("bucket")
            .orderBy("bucket", "ASC")
            .getRawMany();
        return {
            bucket: q.bucket,
            from: q.from,
            to: q.to,
            rows,
        };
    }
    bucketExpr(column, bucket) {
        switch (bucket) {
            case "1m":
                return `date_trunc('minute', ${column})`;
            case "5m":
                return `date_trunc('hour', ${column}) + (floor(extract(minute from ${column})/5)* interval '5 minutes')`;
            case "15m":
                return `date_trunc('hour', ${column}) + (floor(extract(minute from ${column})/15)* interval '15 minutes')`;
            case "1h":
                return `date_trunc('hour', ${column})`;
            case "1d":
                return `date_trunc('day', ${column})`;
            default:
                return `date_trunc('minute', ${column})`;
        }
    }
    async getOpenJobs(userId, q) {
        try {
            const page = Math.max(1, q.page || 1);
            const limit = Math.min(100, Math.max(1, q.limit || 20));
            const offset = (page - 1) * limit;
            const base = data_source_1.default.createQueryBuilder()
                .from("broker_jobs", "j")
                .innerJoin("broker_credentials", "c", "c.id = j.credential_id")
                .where("c.user_id = :userId", { userId })
                .andWhere("j.status = ANY(:openStatuses)", {
                openStatuses: OPEN_STATUSES,
            });
            if (q.type)
                base.andWhere("j.type = :type", { type: q.type });
            const totalRow = await base
                .clone()
                .select("COUNT(*)::int", "total")
                .getRawOne();
            const total = Number(totalRow?.total ?? 0);
            const rows = await base
                .clone()
                .select([
                "j.id as id",
                "j.type as type",
                "j.status as status",
                "j.attempts as attempts",
                "j.last_error as lastError",
                "j.payload as payload",
                "j.created_at as createdAt",
                "j.updated_at as updatedAt",
                "a.id as lastAlertId",
                "a.ticker as lastTicker",
                "a.exchange as lastExchange",
                "a.close as lastClose",
                "a.created_at as lastAlertAt",
            ])
                .leftJoin((qb) => qb
                .from("alert_snapshots", "a")
                .where("a.job_id = j.id")
                .orderBy("a.created_at", "DESC")
                .limit(1), "a", "TRUE")
                .orderBy("j.updated_at", "DESC")
                .offset(offset)
                .limit(limit)
                .getRawMany();
            return { page, limit, total, rows };
        }
        catch (error) {
            throw error;
        }
    }
}
exports.AlertSnapshotDB = AlertSnapshotDB;
