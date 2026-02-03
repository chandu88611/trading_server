import AppDataSource from "../../../db/data-source";
import { In, QueryRunner, Repository } from "typeorm";
import { BrokerJob } from "../../../entity";
import { AssetClassifier } from "../../../types/trade-identify";
import { CTradeSignal, CTradeSignalStatus } from "../../../entity/CTradeSignals";
import { ICreateTradeSignal } from "../../broker/brokerSignals/interfaces/tradeSignal.interface";
import { ClaimedSignal } from "../../../db/enums";

export class CTradeSignalDB {
  private repo: Repository<CTradeSignal>;
  private repoStatus: Repository<CTradeSignalStatus>;
  private jobRepo: Repository<BrokerJob>;

  constructor() {
    this.repo = AppDataSource.getRepository(CTradeSignal);
    this.repoStatus = AppDataSource.getRepository(CTradeSignalStatus);
    this.jobRepo = AppDataSource.getRepository(BrokerJob);
  }

  async createTradeSignal(alertData: ICreateTradeSignal, queryRunner: QueryRunner) {
    const entity = queryRunner.manager.getRepository(CTradeSignal).create({
      jobId: alertData.jobId,
      action: alertData.action,
      symbol: alertData.symbol,
      price: alertData.price,
      exchange: alertData.exchange,
      signalTime: alertData.signalTime,
      assetType: AssetClassifier.detect({
        symbol: alertData.symbol,
        exchange: alertData.exchange,
      }),
    });

    const saved = await queryRunner.manager.getRepository(CTradeSignal).save(entity);

    const statusEntity = queryRunner.manager.getRepository(CTradeSignalStatus).create({
      tradeSignalId: saved.id,
      status: "pending",
    });

    await queryRunner.manager.getRepository(CTradeSignalStatus).save(statusEntity);

    return saved;
  }

  async create(payload: ICreateTradeSignal) {
    const job = await this.jobRepo.findOne({ where: { id: payload.jobId } });
    if (!job) throw new Error("job_not_found");

    const entity = this.repo.create({
      brokerJob: { id: payload.jobId } as BrokerJob,
      action: payload.action,
      symbol: payload.symbol,
      price: payload.price,
      exchange: payload.exchange,
      signalTime: payload.signalTime,
    });

    return this.repo.save(entity);
  }

  async listByJob(jobId: number) {
    return this.repo.find({
      where: { brokerJob: { id: jobId } },
      order: { createdAt: "DESC" },
    });
  }

  async getAllTradeTo({ start, count }: { start: number; count: number }) {
    const data: CTradeSignal[] = await this.repo
      .createQueryBuilder("cts")
      .innerJoinAndSelect(CTradeSignalStatus, "ctss", "cts.id = ctss.trade_signal_id")
      .where("ctss.status = :status", { status: "pending" })
      .skip(start)
      .take(count)
      .getMany();

    return data;
  }

  async claimPendingTrades(limit: number): Promise<ClaimedSignal[]> {
    const qr = AppDataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const statusRepo = qr.manager.getRepository(CTradeSignalStatus);

      // Select tradeSignalId rows from status table
      const qb: any = statusRepo
        .createQueryBuilder("s")
        .select("s.tradeSignalId", "id")
        .where("s.status = :status", { status: "pending" })
        .orderBy("s.tradeSignalId", "ASC")
        .limit(limit)
        .setLock("pessimistic_write");

      // TypeORM versions differ: setOnLocked may not exist in typings
      if (typeof qb.setOnLocked === "function") qb.setOnLocked("skip_locked");

      const rows: Array<{ id: any }> = await qb.getRawMany();
      const ids = rows.map((r) => Number(r.id)).filter(Boolean);

      if (!ids.length) {
        await qr.commitTransaction();
        return [];
      }

      // Mark claimed -> processing
      await statusRepo
        .createQueryBuilder()
        .update(CTradeSignalStatus)
        .set({ status: "processing", updatedAt: new Date() })
        .where("tradeSignalId IN (:...ids)", { ids })
        .execute();

      // Fetch signals
      const signals = await qr.manager
      .getRepository(CTradeSignal)
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
      const ordered = ids.map((id) => map.get(id)).filter(Boolean) as CTradeSignal[];
const badIds: number[] = [];
    const structured: ClaimedSignal[] = [];

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
        signalTime: s.signalTime instanceof Date ? s.signalTime.toISOString() : new Date(s.signalTime as any).toISOString(),
        userId: Number(userId),
      });
    }

    // 6) Any bad ones -> set status FAILED so they don’t keep getting re-claimed forever
    if (badIds.length) {
      await statusRepo
        .createQueryBuilder()
        .update(CTradeSignalStatus)
        .set({ status: "FAILED", updatedAt: new Date() })
        .where("tradeSignalId IN (:...ids)", { ids: badIds })
        .execute();
    }
      await qr.commitTransaction();
      return structured;
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  async updateTradeStatus(data: { id: number; status: string }[]) {
    await Promise.all(
      data.map(async (item) => {
        await this.repoStatus
          .createQueryBuilder()
          .update(CTradeSignalStatus)
          .set({ status: item.status, updatedAt: new Date() })
          .where("trade_signal_id = :id", { id: item.id })
          .execute();
      })
    );
  }
}
