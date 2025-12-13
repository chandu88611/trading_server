"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSubscriptionDBService = void 0;
const entity_1 = require("../../../entity");
const data_source_1 = __importDefault(require("../../../db/data-source"));
const userSubscription_enum_1 = require("../enums/userSubscription.enum");
class UserSubscriptionDBService {
    constructor() {
        this.subRepo = data_source_1.default.getRepository(entity_1.UserSubscription);
        this.planRepo = data_source_1.default.getRepository(entity_1.SubscriptionPlan);
    }
    getActiveSubscription(userId) {
        return this.subRepo.findOne({
            where: {
                userId,
                status: userSubscription_enum_1.UserSubscriptionStatus.ACTIVE,
            },
            relations: ["plan"],
        });
    }
    getPlan(planId) {
        return this.planRepo.findOne({ where: { id: planId, isActive: true } });
    }
    async createSubscription(userId, planId, durationDays) {
        const subscription = this.subRepo.create({
            userId,
            planId,
            startDate: new Date(),
            endDate: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
            status: userSubscription_enum_1.UserSubscriptionStatus.ACTIVE,
        });
        return this.subRepo.save(subscription);
    }
    async cancelSubscription(userId) {
        return this.subRepo.update({ userId, status: userSubscription_enum_1.UserSubscriptionStatus.ACTIVE }, {
            status: userSubscription_enum_1.UserSubscriptionStatus.CANCELED,
            cancelAt: new Date(),
        });
    }
    getAllUserSubscriptions(offset = 0, limit = 20) {
        return this.subRepo.findAndCount({
            skip: offset,
            take: limit,
            relations: ["plan"],
            order: { createdAt: "DESC" },
        });
    }
    getUserSubscriptions(userId) {
        return this.subRepo.find({
            where: { userId },
            relations: ["plan"],
            order: { createdAt: "DESC" },
        });
    }
}
exports.UserSubscriptionDBService = UserSubscriptionDBService;
