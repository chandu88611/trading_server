import { BrokerCredentialDB } from "../db/brokerCredential.db";
import { ICreateBrokerCredential, IUpdateBrokerCredential } from "../interfaces/brokerCredential.interface";

export class BrokerCredentialService {
  private db: BrokerCredentialDB;
  constructor() {
    this.db = new BrokerCredentialDB();
  }

  async create(payload: ICreateBrokerCredential) {
    // encryption/validation could be added here
    return this.db.create(payload);
  }

  async get(id: number) {
    return this.db.getById(id);
  }

  async listByUser(userId: number) {
    return this.db.listByUser(userId);
  }

  async update(id: number, payload: IUpdateBrokerCredential) {
    return this.db.update(id, payload);
  }

  async delete(id: number) {
    return this.db.delete(id);
  }
}
