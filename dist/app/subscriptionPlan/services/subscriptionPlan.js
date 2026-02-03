"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionPlanService = void 0;
// src/app/subscriptionPlan/services/subscriptionPlan.ts
const constants_1 = require("../../../types/constants");
const subscriptionPlan_db_1 = require("./subscriptionPlan.db");
class SubscriptionPlanService {
    constructor() {
        this.db = new subscriptionPlan_db_1.SubscriptionPlanDBService();
    }
    async createPlan(payload) {
        if (!payload.name?.trim()) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "name is required" };
        }
        if (!payload.planTypeCode) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "planTypeCode is required" };
        }
        // pricing validation if provided
        if (payload.pricing) {
            if (payload.pricing.priceInr == null || payload.pricing.priceInr < 0) {
                throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "pricing.priceInr must be >= 0" };
            }
        }
        return this.db.createPlan({
            ...payload,
            name: payload.name.trim(),
            description: payload.description ?? null,
            metadata: payload.metadata ?? {},
            isActive: payload.isActive ?? true,
        });
    }
    async getPlan(id) {
        if (!id?.trim()) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "Invalid planId" };
        }
        const plan = await this.db.getPlanById(id);
        if (!plan) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "Plan not found" };
        }
        return plan;
    }
    async updatePlan(id, payload) {
        if (!id?.trim()) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "Invalid planId" };
        }
        const existing = await this.db.getPlanById(id);
        if (!existing) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "Plan not found" };
        }
        if (payload.name !== undefined && !payload.name.trim()) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "name cannot be empty" };
        }
        await this.db.updatePlan(id, {
            ...payload,
            name: payload.name?.trim(),
            description: payload.description ?? undefined,
        });
        return true;
    }
    async deactivatePlan(id) {
        if (!id?.trim()) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "Invalid planId" };
        }
        const plan = await this.db.getPlanById(id);
        if (!plan) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "Plan not found" };
        }
        await this.db.updatePlan(id, { isActive: false });
        return true;
    }
    getPlans(query) {
        return this.db.getPlans(query);
    }
}
exports.SubscriptionPlanService = SubscriptionPlanService;
