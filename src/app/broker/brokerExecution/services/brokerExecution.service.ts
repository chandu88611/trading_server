import { Repository } from "typeorm";
import { BrokerJob } from "../../../../entity";
import AppDataSource from "../../../../db/data-source";

export class BrokerExecutionService {
  private jobRepo: Repository<BrokerJob>;

  constructor() {
    this.jobRepo = AppDataSource.getRepository(BrokerJob);
  }

  // claim a pending job (transactional)
  async claimPendingJob(): Promise<BrokerJob | null> {
    // simple approach: findOne pending oldest and update status to 'in_progress'
    // use queryBuilder to ensure atomicity
    const qb = this.jobRepo.createQueryBuilder();
    const job = await qb
      .setLock("pessimistic_write")
      .where("status = :status", { status: "pending" })
      .orderBy("created_at", "ASC")
      .limit(1)
      .getOne();

    if (!job) return null;

    await this.jobRepo.update({ id: job.id }, { status: "in_progress", attempts: job.attempts + 1 });
    return this.jobRepo.findOne({ where: { id: job.id }, relations: ["credential"] });
  }

  async markCompleted(jobId: number) {
    await this.jobRepo.update({ id: jobId }, { status: "completed" });
  }

  async markFailed(jobId: number, error: string, attempts: number, maxAttempts: number) {
    const status = attempts >= maxAttempts ? "failed" : "pending";
    await this.jobRepo.update({ id: jobId }, { status, lastError: error, attempts });
  }

  async fetchPendingCount() {
    return this.jobRepo.count({ where: { status: "pending" } });
  }
}
