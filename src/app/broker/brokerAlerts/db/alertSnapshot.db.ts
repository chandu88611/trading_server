import AppDataSource from "../../../../db/data-source";
import { QueryRunner, Repository } from "typeorm";
import { ICreateAlertSnapshot } from "../interfaces/alertSnapshot.interface";
import { AlertSnapshot } from "../../../../entity/AlertSnapshots";
import { BrokerJob } from "../../../../entity";

export class AlertSnapshotDB {
  private repo: Repository<AlertSnapshot>;
  private jobRepo: Repository<BrokerJob>;

  constructor() {
    this.repo = AppDataSource.getRepository(AlertSnapshot);
    this.jobRepo = AppDataSource.getRepository(BrokerJob);
  }

  async create(
    payload: ICreateAlertSnapshot,
    brokerJobId: number,
    queryRunner: QueryRunner
  ) {
    try {
      const entity: AlertSnapshot = queryRunner.manager
        .getRepository(AlertSnapshot)
        .create({
          brokerJob: { id: brokerJobId } as BrokerJob,
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
        .getRepository(AlertSnapshot)
        .save(entity);
    } catch (error) {
      throw error;
    }
  }

  async listByJob(jobId: number) {
    return this.repo.find({
      where: { brokerJob: { id: jobId } },
      order: { createdAt: "DESC" },
    });
  }

  // alertSnapshot.db.ts

  async getHistory(q: {
    userId: number;
    page: number;
    limit: number;
    ticker?: string;
    exchange?: string;
    interval?: string;
    jobId?: number;
    from: Date;
    to: Date;
  }) {
    const offset = (q.page - 1) * q.limit;

    const base = AppDataSource.createQueryBuilder()
      .from("alert_snapshots", "a")
      .innerJoin("broker_jobs", "j", "j.id = a.job_id")
      .innerJoin("broker_credentials", "c", "c.id = j.credential_id")
      .where("c.user_id = :userId", { userId: q.userId })
      .andWhere("a.created_at BETWEEN :from AND :to", {
        from: q.from,
        to: q.to,
      });

    if (q.jobId) base.andWhere("j.id = :jobId", { jobId: q.jobId });
    if (q.ticker) base.andWhere("a.ticker = :ticker", { ticker: q.ticker });
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

  async getTimeline(q: {
    userId: number;
    bucket: "1m" | "5m" | "15m" | "1h" | "1d";
    ticker?: string;
    exchange?: string;
    interval?: string;
    jobId?: number;
    from: Date;
    to: Date;
  }) {
    const bucketExpr = this.bucketExpr("a.created_at", q.bucket);

    const qb = AppDataSource.createQueryBuilder()
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

    if (q.jobId) qb.andWhere("j.id = :jobId", { jobId: q.jobId });
    if (q.ticker) qb.andWhere("a.ticker = :ticker", { ticker: q.ticker });
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

  private bucketExpr(
    column: string,
    bucket: "1m" | "5m" | "15m" | "1h" | "1d"
  ) {
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
}
