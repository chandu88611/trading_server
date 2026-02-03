import AppDataSource from "../../../../db/data-source";
import { Repository } from "typeorm";
import { BrokerCredential, ForexTradeCategory, User } from "../../../../entity";
import {
  ICreateBrokerCredential,
  IUpdateBrokerCredential,
} from "../interfaces/brokerCredential.interface";
import { HttpStatusCode } from "../../../../types/constants";
import { ForexTraderUserDetails } from "../../../../entity/ForexTraderUserDetails";

export class BrokerCredentialDB {
  private repo: Repository<BrokerCredential>;
  private userRepo: Repository<User>;
  private forexRepo: Repository<ForexTraderUserDetails>;

  constructor() {
    this.repo = AppDataSource.getRepository(BrokerCredential);
    this.userRepo = AppDataSource.getRepository(User);
    this.forexRepo = AppDataSource.getRepository(ForexTraderUserDetails);
  }
  async getCredentialIdByUserId(userId: number): Promise<{id: number, keyName: string | null}[]> {
    try {
      let userTradeStatus = await this.userRepo.findOne({
        where: { id: userId },
      });
      if (!userTradeStatus || !userTradeStatus.allowTrade) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "trading_access_disabled",
        };
      }
      const credential = await this.repo.find({
        where: { user: { id: userId } },
      });
      if (!credential || credential.length === 0) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "credential_not_found",
        };
      }
      return credential.map((item) => ({id: item.id, keyName: item.keyName}));
    } catch (error) {
      throw error;
    }
  }

  async getTypeOfBrokerByUserId(userId: number): Promise<ForexTradeCategory[]> {
    try {
      let data = await this.forexRepo.find({
        where: { user: { id: userId } },
      });
      if (!data) {
        throw {
          statusCode: HttpStatusCode._BAD_REQUEST,
          message: "forex_trader_details_not_found",
        };
      }
      return data.map((item) => item.forexType);
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
    return this.repo.find({
      where: { user: { id: userId } },
      order: { createdAt: "DESC" },
    });
  }

  async update(id: number, payload: IUpdateBrokerCredential) {
    await this.repo.update(
      { id },
      {
        keyName: payload.keyName,
        encApiKey: payload.encApiKey,
        encApiSecret: payload.encApiSecret,
        encRequestToken: payload.encRequestToken,
        status: payload.status,
      }
    );
    return this.getById(id);
  }

  async delete(id: number) {
    return this.repo.delete({ id });
  }
}
