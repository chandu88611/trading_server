"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForexTraderUserDetailsDBService = void 0;
const data_source_1 = __importDefault(require("../../../db/data-source"));
const ForexTraderUserDetails_1 = require("../../../entity/ForexTraderUserDetails");
class ForexTraderUserDetailsDBService {
    repo(qr) {
        return qr
            ? qr.manager.getRepository(ForexTraderUserDetails_1.ForexTraderUserDetails)
            : data_source_1.default.getRepository(ForexTraderUserDetails_1.ForexTraderUserDetails);
    }
    async findById(id, qr) {
        return this.repo(qr).findOne({ where: { id: String(id) } });
    }
    async findByUserId(userId, qr) {
        return this.repo(qr).find({
            where: { userId: String(userId) },
            order: { createdAt: "DESC" },
        });
    }
    async findByUserAndType(userId, forexTraderUserId, qr) {
        return this.repo(qr).findOne({
            where: { userId: String(userId), forexTraderUserId },
        });
    }
    async create(payload, qr) {
        const r = this.repo(qr);
        const row = r.create({
            userId: String(payload.userId),
            forexTraderUserId: payload.forexTraderUserId,
            forexType: payload.forexType,
            token: payload.token,
            isMaster: payload.isMaster,
        });
        return r.save(row);
    }
    async updateById(id, patch, qr) {
        const r = this.repo(qr);
        await r.update({ id: String(id) }, patch);
        return this.findById(id, qr);
    }
    async deleteById(id, qr) {
        const res = await this.repo(qr).delete({ id: String(id) });
        return { deleted: res.affected ?? 0 };
    }
    /** one user -> one master only */
    async unsetOtherMastersForUser(userId, keepId, qr) {
        await this.repo(qr)
            .createQueryBuilder()
            .update(ForexTraderUserDetails_1.ForexTraderUserDetails)
            .set({ isMaster: false })
            .where("user_id = :userId", { userId })
            .andWhere("id != :keepId", { keepId })
            .execute();
    }
}
exports.ForexTraderUserDetailsDBService = ForexTraderUserDetailsDBService;
