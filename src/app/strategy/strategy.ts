import { StrategyDBService, StrategyListQuery } from "./strategy.db";

export class StrategyService {
  private db = new StrategyDBService();

  ensureSchema() {
    return this.db.ensureSchema();
  }

  create(payload: any) {
    return this.db.create(payload);
  }

  list(query: StrategyListQuery) {
    return this.db.list(query);
  }

  getById(strategyId: number, options?: { availableOnly?: boolean; userId?: number | null }) {
    return this.db.getDetail(strategyId, options);
  }

  subscribe(userId: number, strategyId: number, payload: any) {
    return this.db.subscribe(userId, strategyId, payload);
  }

  getMyPerformance(userId: number, strategyId: number, accountId?: number | null) {
    return this.db.getMyPerformance(userId, strategyId, accountId);
  }

  update(strategyId: number, payload: any) {
    return this.db.update(strategyId, payload);
  }

  retire(strategyId: number) {
    return this.db.retire(strategyId);
  }

  setStrategyActive(strategyId: number, isActive: boolean) {
    return this.db.setStrategyActive(strategyId, isActive);
  }

  setUserStrategyInstanceStatus(
    userId: number,
    instanceId: number,
    status: "active" | "paused"
  ) {
    return this.db.setUserStrategyInstanceStatus(userId, instanceId, status);
  }

  setUserStrategyStatusByStrategyId(
    userId: number,
    strategyId: number,
    status: "active" | "paused"
  ) {
    return this.db.setUserStrategyStatusByStrategyId(userId, strategyId, status);
  }

  setUserStrategyInstanceVolume(
    userId: number,
    instanceId: number,
    volume: number
  ) {
    return this.db.setUserStrategyInstanceVolume(userId, instanceId, volume);
  }
}
