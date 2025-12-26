import AppDataSource from "../../../db/data-source";
import { ForexTradeCategory } from "../../../entity/entity.enum";
import { ForexTraderUserDetailsDBService } from "./forexTraderUserDetails.db";

export class ForexTraderUserDetailsService {
  private db = new ForexTraderUserDetailsDBService();

  private toNum(v: any) {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }

  private toStr(v: any) {
    return String(v ?? "").trim();
  }

  private isValidForexType(v: any): v is ForexTradeCategory {
    return Object.values(ForexTradeCategory).includes(v);
  }

  async upsertMyDetails(
    userId: number,
    body: {
      forexTraderUserId: string;
      forexType: ForexTradeCategory;
      token: string;
      isMaster?: boolean; // default true
    }
  ) {
    const uid = this.toNum(userId);
    if (!uid) throw { status: 400, message: "invalid_userId" };

    const forexTraderUserId = this.toStr(body.forexTraderUserId);
    const token = this.toStr(body.token);

    if (!forexTraderUserId)
      throw { status: 400, message: "forexTraderUserId_required" };
    if (!this.isValidForexType(body.forexType))
      throw { status: 400, message: "invalid_forexType" };
    if (!token && body.forexType !== ForexTradeCategory.MT5) throw { status: 400, message: "token_required" };

    const isMaster = typeof body.isMaster === "boolean" ? body.isMaster : true;

    const qr = AppDataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const existing = await this.db.findByUserAndType(uid, body.forexType, qr);

      const row = existing
        ? await this.db.updateById(
            Number(existing.id),
            { forexTraderUserId, token, isMaster },
            qr
          )
        : await this.db.create(
            {
              userId: uid,
              forexTraderUserId,
              forexType: body.forexType,
              token,
              isMaster,
            },
            qr
          );

      if (!row) throw { status: 500, message: "save_failed" };

      // ✅ enforce one user -> one master only
      if (row.isMaster) {
        await this.db.unsetOtherMastersForUser(uid, Number(row.id), qr);
      }

      await qr.commitTransaction();

      // don’t return token to UI (safe response)
      return {
        id: Number(row.id),
        userId: Number(row.userId),
        forexTraderUserId: row.forexTraderUserId,
        forexType: row.forexType,
        isMaster: row.isMaster,
        hasToken: !!row.token,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  async getMyDetails(userId: number) {
    const uid = this.toNum(userId);
    if (!uid) throw { status: 400, message: "invalid_userId" };

    const rows = await this.db.findByUserId(uid);

    // don’t return token
    return rows.map((r) => ({
      id: Number(r.id),
      userId: Number(r.userId),
      forexTraderUserId: r.forexTraderUserId,
      forexType: r.forexType,
      isMaster: r.isMaster,
      hasToken: !!r.token,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async updateMyDetailById(
    userId: number,
    id: number,
    patch: {
      forexTraderUserId?: string;
      token?: string | null;
      isMaster?: boolean;
    }
  ) {
    const uid = this.toNum(userId);
    const rid = this.toNum(id);
    if (!uid) throw { status: 400, message: "invalid_userId" };
    if (!rid) throw { status: 400, message: "invalid_id" };

    const row = await this.db.findById(rid);
    if (!row) throw { status: 404, message: "not_found" };
    if (Number(row.userId) !== uid) throw { status: 403, message: "forbidden" };

    const update: any = {};

    if (patch.forexTraderUserId !== undefined) {
      const v = this.toStr(patch.forexTraderUserId);
      if (!v) throw { status: 400, message: "forexTraderUserId_invalid" };
      update.forexTraderUserId = v;
    }

    if (patch.token !== undefined) {
      if (patch.token !== null && typeof patch.token !== "string") {
        throw { status: 400, message: "token_invalid" };
      }
      update.token = patch.token;
    }

    if (patch.isMaster !== undefined) {
      if (typeof patch.isMaster !== "boolean")
        throw { status: 400, message: "isMaster_invalid" };
      update.isMaster = patch.isMaster;
    }

    const qr = AppDataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const updated = await this.db.updateById(rid, update, qr);
      if (!updated) throw { status: 500, message: "update_failed" };

      if (updated.isMaster) {
        await this.db.unsetOtherMastersForUser(uid, rid, qr);
      }

      await qr.commitTransaction();

      return {
        id: Number(updated.id),
        userId: Number(updated.userId),
        forexTraderUserId: updated.forexTraderUserId,
        forexType: updated.forexType,
        isMaster: updated.isMaster,
        hasToken: !!updated.token,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  async deleteMyDetailById(userId: number, id: number) {
    const uid = this.toNum(userId);
    const rid = this.toNum(id);
    if (!uid) throw { status: 400, message: "invalid_userId" };
    if (!rid) throw { status: 400, message: "invalid_id" };

    const row = await this.db.findById(rid);
    if (!row) throw { status: 404, message: "not_found" };
    if (Number(row.userId) !== uid) throw { status: 403, message: "forbidden" };

    return this.db.deleteById(rid);
  }
}
