"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyService = void 0;
const strategy_db_1 = require("./strategy.db");
class StrategyService {
    constructor() {
        this.db = new strategy_db_1.StrategyDBService();
    }
    create(payload) {
        return this.db.create(payload);
    }
    list(query) {
        return this.db.list(query);
    }
    setStrategyActive(strategyId, isActive) {
        return this.db.setStrategyActive(strategyId, isActive);
    }
    setUserStrategyInstanceStatus(userId, instanceId, status) {
        return this.db.setUserStrategyInstanceStatus(userId, instanceId, status);
    }
}
exports.StrategyService = StrategyService;
