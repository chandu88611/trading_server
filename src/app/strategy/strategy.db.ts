import { Repository } from "typeorm";
import AppDataSource from "../../db/data-source";
import { Strategy } from "../../entity/Strategy";

export class StrategyDBService {
  private repo: Repository<Strategy>;

  constructor() {
    this.repo = AppDataSource.getRepository(Strategy);
  }

  async create(payload: any) {
    if (!payload?.name?.trim()) throw { statusCode: 400, message: "name required" };
    if (!payload?.category?.trim()) throw { statusCode: 400, message: "category required" };

    const row = this.repo.create({
      name: payload.name.trim(),
      description: payload.description ?? null,
      category: payload.category.trim(),
      risk: payload.risk ?? "Medium",
      marketCodes: Array.isArray(payload.marketCodes) ? payload.marketCodes : [],
      avgMonthlyReturnPct: payload.avgMonthlyReturnPct ?? 0,
      winRatePct: payload.winRatePct ?? 0,
      maxDrawdownPct: payload.maxDrawdownPct ?? 0,
      isActive: payload.isActive ?? true,
    });

    return this.repo.save(row);
  }

  list(query: { isActive?: boolean }) {
    return this.repo.find({
      where: query.isActive === undefined ? {} : ({ isActive: query.isActive } as any),
      order: { createdAt: "DESC" } as any,
    });
  }
}
