import AppDataSource from "../../../../db/data-source";
import { Repository } from "typeorm";
import { BrokerSession, BrokerCredential } from "../../../../entity";
import { ICreateBrokerSession, IUpdateBrokerSession } from "../interfaces/brokerSession.interface";

export class BrokerSessionDB {
  private repo: Repository<BrokerSession>;
  private credRepo: Repository<BrokerCredential>;

  constructor() {
    this.repo = AppDataSource.getRepository(BrokerSession);
    this.credRepo = AppDataSource.getRepository(BrokerCredential);
  }

  async create(payload: ICreateBrokerSession) {
    const cred = await this.credRepo.findOne({ where: { id: payload.credentialId } });
    if (!cred) throw new Error("credential_not_found");
    const s = this.repo.create({
      credential: { id: payload.credentialId } as BrokerCredential,
      sessionToken: payload.sessionToken ?? null,
      expiresAt: payload.expiresAt ?? null,
      lastRefreshedAt: payload.lastRefreshedAt ?? null,
      status: "valid",
    });
    return this.repo.save(s);
  }

  async update(id: number, payload: IUpdateBrokerSession) {
    await this.repo.update({ id }, {
      sessionToken: payload.sessionToken,
      expiresAt: payload.expiresAt,
      lastRefreshedAt: payload.lastRefreshedAt,
      status: payload.status,
    });
    return this.repo.findOne({ where: { id } });
  }

  async getValidByCredential(credentialId: number) {
    return this.repo.find({ where: { credential: { id: credentialId }, status: "valid" } });
  }

  async revokeAllForCredential(credentialId: number) {
    await this.repo.update({ credential: { id: credentialId } as BrokerCredential }, { status: "revoked" } as any);
  }
}
