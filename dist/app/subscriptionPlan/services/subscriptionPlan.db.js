"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionPlanDBService = void 0;
const typeorm_1 = require("typeorm");
const entity_1 = require("../../../entity");
const data_source_1 = __importDefault(require("../../../db/data-source"));
class SubscriptionPlanDBService {
    constructor() {
        this.planRepo = data_source_1.default.getRepository(entity_1.SubscriptionPlan);
    }
    createPlan(payload) {
        const plan = this.planRepo.create(payload);
        return this.planRepo.save(plan);
    }
    getPlanById(id) {
        return this.planRepo.findOne({ where: { id } });
    }
    updatePlan(id, payload) {
        return this.planRepo.update({ id }, payload);
    }
    deletePlan(id) {
        return this.planRepo.delete({ id });
    }
    async getPlans(query) {
        const { chunkSize = 10, initialOffset = 0, searchParam } = query;
        return this.planRepo.findAndCount({
            where: searchParam
                ? [{ name: (0, typeorm_1.ILike)(`%${searchParam}%`) }, { planCode: (0, typeorm_1.ILike)(`%${searchParam}%`) }]
                : {},
            skip: initialOffset,
            take: chunkSize,
            order: { createdAt: "DESC" },
        });
    }
    getActivePlans() {
        return this.planRepo.find({
            where: { isActive: true },
            order: { priceCents: "ASC" },
        });
    }
}
exports.SubscriptionPlanDBService = SubscriptionPlanDBService;
