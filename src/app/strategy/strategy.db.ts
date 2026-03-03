import { Repository } from "typeorm";
import AppDataSource from "../../db/data-source";
import { Strategy } from "../../entity/Strategy";
import { HttpStatusCode } from "../../types/constants";

export class StrategyDBService {
  private repo: Repository<Strategy>;

  constructor() {
    this.repo = AppDataSource.getRepository(Strategy);
  }

  async create(payload: any) {
    if (!payload?.name?.trim()) throw { statusCode: 400, message: "name required" };
    if (!payload?.category?.trim()) throw { statusCode: 400, message: "category required" };

    const strategyCode = String(payload.strategyCode ?? payload.strategy_code ?? payload.name)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 120);

    const row = this.repo.create({
      strategyCode,
      name: payload.name.trim(),
      description: payload.description ?? null,
      category: payload.category.trim(),
      version: Number(payload.version ?? 1),
      defaultParams: payload.defaultParams ?? payload.default_params ?? {},
      riskProfile: payload.riskProfile ?? payload.risk_profile ?? payload.risk ?? null,
      capitalRequirement:
        payload.capitalRequirement ?? payload.capital_requirement ?? null,
      isActive: payload.isActive ?? true,
      isDeprecated: payload.isDeprecated ?? false,
      isCopyable: payload.isCopyable ?? true,
    });

    return this.repo.save(row);
  }

  list(query: { isActive?: boolean }) {
    return this.repo.find({
      where: query.isActive === undefined ? {} : ({ isActive: query.isActive } as any),
      order: { createdAt: "DESC" } as any,
    });
  }

  async setStrategyActive(strategyId: number, isActive: boolean) {
    if (!Number.isFinite(strategyId) || strategyId <= 0) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "invalid_strategy_id" };
    }

    const rows = await this.repo.manager.query(
      `
      UPDATE strategies
      SET is_active = $2,
          updated_at = now()
      WHERE id = $1
      RETURNING id, strategy_code, name, is_active, updated_at
      `,
      [strategyId, isActive]
    );

    const row = rows?.[0];
    if (!row) {
      throw { statusCode: HttpStatusCode._NOT_FOUND, message: "strategy_not_found" };
    }

    return row;
  }

  async setUserStrategyInstanceStatus(
    userId: number,
    instanceId: number,
    status: "active" | "paused"
  ) {
    if (!Number.isFinite(userId) || userId <= 0) {
      throw { statusCode: HttpStatusCode._UNAUTHORISED, message: "user_not_authorized" };
    }
    if (!Number.isFinite(instanceId) || instanceId <= 0) {
      throw { statusCode: HttpStatusCode._BAD_REQUEST, message: "invalid_instance_id" };
    }

    const rows = await this.repo.manager.query(
      `
      UPDATE user_strategy_instances
      SET status = $3,
          paused_at = CASE WHEN $3 = 'paused' THEN now() ELSE NULL END,
          updated_at = now()
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id, strategy_id, trading_account_id, status, paused_at, updated_at
      `,
      [instanceId, userId, status]
    );

    const row = rows?.[0];
    if (!row) {
      throw {
        statusCode: HttpStatusCode._NOT_FOUND,
        message: "user_strategy_instance_not_found",
      };
    }

    return row;
  }
}
