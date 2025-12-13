import { BrokerSessionDB } from "../db/brokerSession.db";
import { ICreateBrokerSession, IUpdateBrokerSession } from "../interfaces/brokerSession.interface";

export class BrokerSessionService {
  private db = new BrokerSessionDB();

  async create(payload: ICreateBrokerSession) {
    return this.db.create(payload);
  }

  async update(id: number, payload: IUpdateBrokerSession) {
    return this.db.update(id, payload);
  }

  async getValidSessions(credentialId: number) {
    return this.db.getValidByCredential(credentialId);
  }

  async revokeAll(credentialId: number) {
    return this.db.revokeAllForCredential(credentialId);
  }
}
