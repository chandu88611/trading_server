import { StrategyDBService } from "./strategy.db";

export class StrategyService {
  private db = new StrategyDBService();

  create(payload: any) {
    return this.db.create(payload);
  }

  list(query: { isActive?: boolean }) {
    return this.db.list(query);
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
}
