import AppDataSource from "../../../../db/data-source";
import { Repository } from "typeorm";
import { BrokerCredential, User } from "../../../../entity";
import { ICreateBrokerCredential, IUpdateBrokerCredential } from "../interfaces/brokerCredential.interface";
import { HttpStatusCode } from "../../../../types/constants";

export class BrokerCredentialDB {
  private repo: Repository<BrokerCredential>;
  private userRepo: Repository<User>;

  constructor() {
    this.repo = AppDataSource.getRepository(BrokerCredential);
    this.userRepo = AppDataSource.getRepository(User);
  }
  async getCredentialIdByUserId(userId: number):Promise<number>{
    try {
      const credential = await this.repo.findOne({ where: { user: { id: userId } } });
      if (!credential){
        throw{
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "credential_not_found"
        }
      }
      return credential.id;
    } catch (error) {
      throw error;
    }
  }

  async create(payload: ICreateBrokerCredential) {
    const user = await this.userRepo.findOne({ where: { id: payload.userId } });
    if (!user) throw new Error("user_not_found");
    const record = this.repo.create({
      user: { id: payload.userId } as User,
      keyName: payload.keyName ?? null,
      encApiKey: payload.encApiKey ?? null,
      encApiSecret: payload.encApiSecret ?? null,
      encRequestToken: payload.encRequestToken ?? null,
      status: payload.status ?? "active",
    });
    return await this.repo.save(record);
  }

  async getById(id: number) {
    return this.repo.findOne({ where: { id }, relations: ["user"] });
  }

  async listByUser(userId: number) {
    return this.repo.find({ where: { user: { id: userId } }, order: { createdAt: "DESC" } });
  }

  async update(id: number, payload: IUpdateBrokerCredential) {
    await this.repo.update({ id }, {
      keyName: payload.keyName,
      encApiKey: payload.encApiKey,
      encApiSecret: payload.encApiSecret,
      encRequestToken: payload.encRequestToken,
      status: payload.status,
    });
    return this.getById(id);
  }

  async delete(id: number) {
    return this.repo.delete({ id });
  }
}
