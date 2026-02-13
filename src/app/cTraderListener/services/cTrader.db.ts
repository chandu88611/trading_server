import { In, Repository } from "typeorm";
import { TradeSignal } from "../../../entity/TradeSignals";
import { TradeSignalStatus } from "../../../entity/TradeSignalsStatus";
import AppDataSource from "../../../db/data-source";
import { ClaimedSignal } from "../../../db/enums";

export class CTradeSignalDB {
  private tradeSignalRepo: Repository<TradeSignal>;
  private tradeSignalStatusRepo: Repository<TradeSignalStatus>;
  constructor() {
    this.tradeSignalRepo = AppDataSource.getRepository(TradeSignal);
    this.tradeSignalStatusRepo = AppDataSource.getRepository(TradeSignalStatus);
  }

  async getPendingSignalDetailsForCTrader(): Promise<TradeSignal[]> {
    try {
      return await this.tradeSignalRepo
        .createQueryBuilder("ts")
        .leftJoinAndSelect("ts.status", "tss")
        .leftJoinAndSelect("ts.tradingAccount", "ta")
        .leftJoinAndSelect("ta.broker", "b")
        .where("tss.status = :status", { status: "pending" })
        .andWhere("(b.code = :code OR b.name = :name)", { code: "CT", name: "CTrader" })
        .orderBy("ts.createdAt", "ASC")
        .getMany();
    } catch (error) {
      throw error;
    }
  }

  async markJobInProgress(job: TradeSignal) {
    await this.tradeSignalRepo.manager.query(
      `UPDATE trade_signals_status SET status='in_progress' WHERE id=$1`,
      [job.status.id]
    );
  }

  async markJobSuccess(job: TradeSignal) {
    await this.tradeSignalRepo.manager.query(
      `UPDATE trade_signals_status SET status='completed' WHERE id=$1`,
      [job.status.id]
    );
  }

  async markJobFailed(job: TradeSignal, error: string) {
    await this.tradeSignalRepo.manager.query(
      `
      UPDATE trade_signals_status
      SET status='failed',
          last_error=$2,
          attempts=attempts+1
      WHERE id=$1
      `,
      [job.status.id, error]
    );
  }

  async getAllTradeTo({ start, count }: { start: number; count: number }) {
    const data: TradeSignal[] = await this.tradeSignalRepo
      .createQueryBuilder("ts")
      .leftJoinAndSelect("ts.status", "tss")
      .leftJoinAndSelect("ts.tradingAccount", "ta")
      .leftJoinAndSelect("ta.broker", "b")
      .where("tss.status = :status", { status: "pending" })
      .andWhere("(b.code = :code OR b.name = :name)", { code: "CT", name: "CTrader" })
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
      const statusRepo = qr.manager.getRepository(TradeSignalStatus);

      const qb: any = statusRepo
        .createQueryBuilder("s")
        .select("s.tradeSignalId", "id")
        .where("s.status = :status", { status: "pending" })
        .orderBy("s.tradeSignalId", "ASC")
        .limit(limit)
        .setLock("pessimistic_write");

      if (typeof qb.setOnLocked === "function") qb.setOnLocked("skip_locked");

      const rows: Array<{ id: any }> = await qb.getRawMany();
      const ids = rows.map((r) => Number(r.id)).filter(Boolean);

      if (!ids.length) {
        await qr.commitTransaction();
        return [];
      }

      await statusRepo
        .createQueryBuilder()
        .update(TradeSignalStatus)
        .set({ status: "processing", updatedAt: new Date() })
        .where("tradeSignalId IN (:...ids)", { ids })
        .execute();

      // Fetch signals
      const signals = await qr.manager
      .getRepository(TradeSignal)
      .createQueryBuilder("ts")
      .leftJoinAndSelect("ts.tradingAccount", "ta")
      .leftJoinAndSelect("ta.broker", "b")
      .where("ts.id IN (:...ids)", { ids })
      .andWhere("(b.code = :code OR b.name = :name)", { code: "CT", name: "CTrader" })
      .getMany();

      console.log("Claimed trade signals:", signals);
      
      
    //   find({
    //     where: { id: In(ids) },
    //   });


      // keep order as ids
      const map = new Map(signals.map((s) => [s.id, s]));
      const ordered = ids.map((id) => map.get(id)).filter(Boolean) as TradeSignal[];
const badIds: number[] = [];
    const structured: ClaimedSignal[] = [];

    for (const s of ordered) {
      const userId = s?.userId;
      if (!userId || !Number.isFinite(Number(userId))) {
        badIds.push(s.id);
        continue;
      }

      structured.push({
        id: s.id,
        jobId: Number(s.id),
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
        .update(TradeSignalStatus)
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

  async updateTradeStatus(data: { id: number; status: string; error?: string }[]) {
    const ids = data.map((d) => d.id).filter(Boolean);
    if (!ids.length) return;

    const jobs = await this.tradeSignalRepo.find({
      where: { id: In(ids) },
      relations: ["status"],
    });

    const jobMap = new Map(jobs.map((j) => [j.id, j]));

    await Promise.all(
      data.map(async (item) => {
        const job = jobMap.get(item.id);
        if (!job?.status?.id) return;

        const status = String(item.status ?? "").toLowerCase();

        if (status === "in_progress" || status === "processing") {
          await this.markJobInProgress(job);
          return;
        }

        if (status === "completed" || status === "success" || status === "executed") {
          await this.markJobSuccess(job);
          return;
        }

        if (status === "failed" || status === "error") {
          await this.markJobFailed(job, item.error ?? "execution_failed");
          return;
        }

        await this.tradeSignalStatusRepo
          .createQueryBuilder()
          .update(TradeSignalStatus)
          .set({ status: item.status, updatedAt: new Date() })
          .where("tradeSignalId = :id", { id: item.id })
          .execute();
      })
    );
  }
}
