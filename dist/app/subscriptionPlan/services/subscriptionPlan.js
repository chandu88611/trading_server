"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionPlanService = void 0;
const subscriptionPlan_db_1 = require("./subscriptionPlan.db");
class SubscriptionPlanService {
    constructor() {
        this.dbService = new subscriptionPlan_db_1.SubscriptionPlanDBService();
    }
    createPlan(payload) {
        return this.dbService.createPlan(payload);
    }
    getPlan(id) {
        return this.dbService.getPlanById(id);
    }
    updatePlan(id, payload) {
        return this.dbService.updatePlan(id, payload);
    }
    deletePlan(id) {
        return this.dbService.deletePlan(id);
    }
    getPlans(query) {
        return this.dbService.getPlans(query);
    }
    getActivePlans() {
        return this.dbService.getActivePlans();
    }
}
exports.SubscriptionPlanService = SubscriptionPlanService;
