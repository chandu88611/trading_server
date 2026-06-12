"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyService = void 0;
const strategy_db_1 = require("./strategy.db");
class StrategyService {
    constructor() {
        this.db = new strategy_db_1.StrategyDBService();
    }
    ensureSchema() {
        return this.db.ensureSchema();
    }
    create(payload) {
        return this.db.create(payload);
    }
    list(query) {
        return this.db.list(query);
    }
    getById(strategyId, options) {
        return this.db.getDetail(strategyId, options);
    }
    subscribe(userId, strategyId, payload) {
        return this.db.subscribe(userId, strategyId, payload);
    }
    getMyPerformance(userId, strategyId, accountId) {
        return this.db.getMyPerformance(userId, strategyId, accountId);
    }
    update(strategyId, payload) {
        return this.db.update(strategyId, payload);
    }
    retire(strategyId) {
        return this.db.retire(strategyId);
    }
    setStrategyActive(strategyId, isActive) {
        return this.db.setStrategyActive(strategyId, isActive);
    }
    setUserStrategyInstanceStatus(userId, instanceId, status) {
        return this.db.setUserStrategyInstanceStatus(userId, instanceId, status);
    }
    setUserStrategyStatusByStrategyId(userId, strategyId, status) {
        return this.db.setUserStrategyStatusByStrategyId(userId, strategyId, status);
    }
    setUserStrategyInstanceVolume(userId, instanceId, volume) {
        return this.db.setUserStrategyInstanceVolume(userId, instanceId, volume);
    }
}
exports.StrategyService = StrategyService;
