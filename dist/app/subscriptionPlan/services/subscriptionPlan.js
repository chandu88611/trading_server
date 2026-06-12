"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionPlanService = void 0;
// src/app/subscriptionPlan/services/subscriptionPlan.ts
const constants_1 = require("../../../types/constants");
const userSubscription_db_1 = require("../../userSubscription/services/userSubscription.db");
const planStrategy_1 = require("../utils/planStrategy");
const subscriptionPlan_db_1 = require("./subscriptionPlan.db");
class SubscriptionPlanService {
    constructor() {
        this.db = new subscriptionPlan_db_1.SubscriptionPlanDBService();
        this.userSubscriptionDb = new userSubscription_db_1.UserSubscriptionDBService();
    }
    async ensureSchema() {
        await this.db.ensureSchema();
    }
    resolveStrategyId(payload) {
        if (payload.strategyId !== undefined) {
            return payload.strategyId === null ? null : Number(payload.strategyId);
        }
        if (payload.strategyIds !== undefined) {
            if (!Array.isArray(payload.strategyIds)) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "strategyIds must be an array",
                };
            }
            if (payload.strategyIds.length > 1) {
                throw {
                    statusCode: constants_1.HttpStatusCode._BAD_REQUEST,
                    message: "only_one_strategy_per_plan",
                };
            }
            if (payload.strategyIds.length === 1) {
                return Number(payload.strategyIds[0]);
            }
            return null;
        }
        return undefined;
    }
    attachSingleStrategy(plan) {
        const planStrategies = (0, planStrategy_1.normalizePlanStrategies)(plan.planStrategies).slice(0, 1);
        const strategy = planStrategies[0]?.strategy
            ? {
                id: Number(planStrategies[0].strategy.id),
                strategyCode: planStrategies[0].strategy.strategyCode,
                name: planStrategies[0].strategy.name,
                isActive: Boolean(planStrategies[0].strategy.isActive),
            }
            : null;
        return Object.assign(plan, {
            planStrategies,
            strategy,
        });
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
        const strategyId = this.resolveStrategyId(payload);
        const created = await this.db.createPlan({
            ...payload,
            name: payload.name.trim(),
            description: payload.description ?? null,
            metadata: payload.metadata ?? {},
            isActive: payload.isActive ?? true,
            strategyId,
        });
        return created ? this.attachSingleStrategy(created) : created;
    }
    async getPlan(id) {
        if (!id || isNaN(id)) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "Invalid planId" };
        }
        const plan = await this.db.getPlanById(id);
        if (!plan) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "Plan not found" };
        }
        return this.attachSingleStrategy(plan);
    }
    async updatePlan(id, payload) {
        if (!id || isNaN(id)) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "Invalid planId" };
        }
        const existing = await this.db.getPlanById(id);
        if (!existing) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "Plan not found" };
        }
        if (payload.name !== undefined && !payload.name.trim()) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "name cannot be empty" };
        }
        const strategyId = this.resolveStrategyId(payload);
        await this.db.updatePlan(id, {
            ...payload,
            name: payload.name?.trim(),
            description: payload.description ?? undefined,
            strategyId,
        });
        return true;
    }
    async deactivatePlan(id) {
        if (!id || isNaN(id)) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "Invalid planId" };
        }
        const plan = await this.db.getPlanById(id);
        if (!plan) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "Plan not found" };
        }
        await this.db.updatePlan(id, { isActive: false });
        return true;
    }
    async getPlans(query, viewerUserId) {
        const [rows, total] = await this.db.getPlans(query);
        let subscriberActivePlanIds = [];
        if (viewerUserId && Number.isFinite(viewerUserId) && viewerUserId > 0) {
            const activeSubscriptions = await this.userSubscriptionDb.getActiveSubscription(viewerUserId);
            subscriberActivePlanIds = Array.from(new Set((activeSubscriptions || [])
                .map((subscription) => Number(subscription.planId))
                .filter((planId) => Number.isFinite(planId) && planId > 0)));
        }
        const activePlanIdSet = new Set(subscriberActivePlanIds);
        const enrichedRows = rows.map((plan) => Object.assign(this.attachSingleStrategy(plan), {
            subscriberAlreadyHasPlan: activePlanIdSet.has(Number(plan.id)),
        }));
        return {
            rows: enrichedRows,
            total,
            subscriberHasAnyActivePlan: subscriberActivePlanIds.length > 0,
            subscriberActivePlanIds,
        };
    }
    async getAdminWebhookToken(planId) {
        if (!Number.isFinite(planId) || planId <= 0) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "Invalid planId" };
        }
        const token = await this.db.getAdminWebhookToken(planId);
        if (!token) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "Plan not found" };
        }
        return token;
    }
    async rotateAdminWebhookToken(planId) {
        if (!Number.isFinite(planId) || planId <= 0) {
            throw { statusCode: constants_1.HttpStatusCode._BAD_REQUEST, message: "Invalid planId" };
        }
        const plan = await this.db.getPlanById(planId);
        if (!plan) {
            throw { statusCode: constants_1.HttpStatusCode._NOT_FOUND, message: "Plan not found" };
        }
        return this.db.rotateAdminWebhookToken(planId);
    }
    async getPlanByAdminWebhookToken(token) {
        return this.db.findPlanByAdminWebhookToken(token);
    }
}
exports.SubscriptionPlanService = SubscriptionPlanService;
