import { ForexTradeCategory } from "../../../../entity";
import { BrokerCredentialDB } from "../db/brokerCredential.db";
import { ICreateBrokerCredential, IUpdateBrokerCredential } from "../interfaces/brokerCredential.interface";

export class BrokerCredentialService {
  private db: BrokerCredentialDB;
  constructor() {
    this.db = new BrokerCredentialDB();
  }

  async create(payload: ICreateBrokerCredential) {
    
    return await this.db.create(payload);
  }
  async getCredentialIdByUserId(userId: number):Promise<{id: number, keyName: string | null}[]> {
    try {
      return await this.db.getCredentialIdByUserId(userId);
    } catch (error) {
      throw error;
    }
  }
  async getTypeOfBrokerByUserId(userId: number):Promise<ForexTradeCategory[]>{
    try {
      const credential:ForexTradeCategory[] = await this.db.getTypeOfBrokerByUserId(userId);
      if(credential && credential.length>0){
        return credential
      }else{
        throw new Error("credential_not_found");
      }
    } catch (error) {
      throw error;
    }
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
