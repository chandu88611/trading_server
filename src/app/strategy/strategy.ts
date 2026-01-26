import { StrategyDBService } from "./strategy.db";

export class StrategyService {
  private db = new StrategyDBService();

  create(payload: any) {
    return this.db.create(payload);
  }

  list(query: { isActive?: boolean }) {
    return this.db.list(query);
  }
}
