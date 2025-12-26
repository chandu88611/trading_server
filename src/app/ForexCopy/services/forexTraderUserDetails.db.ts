import { QueryRunner, Repository } from "typeorm";
import AppDataSource from "../../../db/data-source";
import { ForexTraderUserDetails } from "../../../entity/ForexTraderUserDetails";
import { ForexTradeCategory } from "../../../entity/entity.enum";

export class ForexTraderUserDetailsDBService {
  private repo(qr?: QueryRunner): Repository<ForexTraderUserDetails> {
    return qr
      ? qr.manager.getRepository(ForexTraderUserDetails)
      : AppDataSource.getRepository(ForexTraderUserDetails);
  }

  async findById(id: number, qr?: QueryRunner) {
    return this.repo(qr).findOne({ where: { id: String(id) as any } });
  }

  async findByUserId(userId: number, qr?: QueryRunner) {
    return this.repo(qr).find({
      where: { userId: String(userId) as any },
      order: { createdAt: "DESC" } as any,
    });
  }

  async findByUserAndType(
    userId: number,
    forexType: ForexTradeCategory,
    qr?: QueryRunner
  ) {
    return this.repo(qr).findOne({
      where: { userId: String(userId) as any, forexType },
    });
  }

  async create(
    payload: {
      userId: number;
      forexTraderUserId: string;
      forexType: ForexTradeCategory;
      token: string | null;
      isMaster: boolean;
    },
    qr?: QueryRunner
  ) {
    const r = this.repo(qr);
    const row = r.create({
      userId: String(payload.userId) as any,
      forexTraderUserId: payload.forexTraderUserId,
      forexType: payload.forexType,
      token: payload.token,
      isMaster: payload.isMaster,
    });
    return r.save(row);
  }

  async updateById(
    id: number,
    patch: Partial<
      Pick<ForexTraderUserDetails, "forexTraderUserId" | "token" | "isMaster">
    >,
    qr?: QueryRunner
  ) {
    const r = this.repo(qr);
    await r.update({ id: String(id) as any }, patch as any);
    return this.findById(id, qr);
  }

  async deleteById(id: number, qr?: QueryRunner) {
    const res = await this.repo(qr).delete({ id: String(id) as any });
    return { deleted: res.affected ?? 0 };
  }

  /** one user -> one master only */
  async unsetOtherMastersForUser(
    userId: number,
    keepId: number,
    qr?: QueryRunner
  ) {
    await this.repo(qr)
      .createQueryBuilder()
      .update(ForexTraderUserDetails)
      .set({ isMaster: false })
      .where("user_id = :userId", { userId })
      .andWhere("id != :keepId", { keepId })
      .execute();
  }
}
