import AppDataSource from "../../../../db/data-source";
import { QueryRunner, Repository } from "typeorm";
import { BrokerJob, BrokerCredential } from "../../../../entity";
import {
  ICreateBrokerJob,
  IUpdateBrokerJob,
} from "../interfaces/brokerJob.interface";

export class BrokerJobDB {
  private repo: Repository<BrokerJob>;
  private credRepo: Repository<BrokerCredential>;

  constructor() {
    this.repo = AppDataSource.getRepository(BrokerJob);
    this.credRepo = AppDataSource.getRepository(BrokerCredential);
  }

  async getOrCreateBrokerJobId(
    payload: ICreateBrokerJob,
    queryRunner: QueryRunner
  ): Promise<number> {
    try {
      const cred = await this.credRepo.findOne({
        where: { id: payload.credentialId },
      });
      if (!cred) throw new Error("credential_not_found");

      const entity = queryRunner.manager.getRepository(BrokerJob).create({
        credential: { id: payload.credentialId } as BrokerCredential,
        type: payload.type,
        payload: payload.payload ?? null,
        status: "pending",
        attempts: 0,
      });

      let data = await queryRunner.manager
        .getRepository(BrokerJob)
        .save(entity);
      return data?.id;
    } catch (error) {
      throw error;
    }
  }

  async create(payload: ICreateBrokerJob) {
    const cred = await this.credRepo.findOne({
      where: { id: payload.credentialId },
    });
    if (!cred) throw new Error("credential_not_found");

    const entity = this.repo.create({
      credential: { id: payload.credentialId } as BrokerCredential,
      type: payload.type,
      payload: payload.payload ?? null,
      status: "pending",
      attempts: 0,
    });

    return this.repo.save(entity);
  }

  async update(id: number, payload: IUpdateBrokerJob) {
    await this.repo.update(
      { id },
      {
        payload: payload.payload,
        attempts: payload.attempts,
        lastError: payload.lastError,
        status: payload.status,
      }
    );
    return this.repo.findOne({ where: { id } });
  }

  async getById(id: number) {
    return this.repo.findOne({
      where: { id },
      relations: ["credential", "alertSnapshots", "tradeSignals"],
    });
  }

  async listByCredential(credentialId: number) {
    return this.repo.find({
      where: { credential: { id: credentialId } },
      order: { createdAt: "DESC" },
    });
  }

  async listPending(limit = 50) {
    return this.repo.find({
      where: { status: "pending" },
      order: { createdAt: "ASC" },
      take: limit,
    });
  }
}
