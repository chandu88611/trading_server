import test from "node:test";
import assert from "node:assert/strict";

const AppDataSource = require("../../db/data-source").default;
const { SubscriptionPlanDBService } = require("../../app/subscriptionPlan/services/subscriptionPlan.db");
const { SubscriptionPlan } = require("../../entity/SubscriptionPlan");
const { PlanAdminWebhookToken } = require("../../entity/PlanAdminWebhookToken");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

test("SubscriptionPlanDBService.ensureSchema creates the token table and migrates legacy plan tokens", async () => {
  const executedQueries: string[] = [];

  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreQuery = patch(AppDataSource, "query", async (sql: string) => {
    executedQueries.push(sql.replace(/\s+/g, " ").trim());
    return [];
  });

  try {
    const service = new SubscriptionPlanDBService();
    await service.ensureSchema();

    assert.ok(
      executedQueries.some((sql) =>
        sql.includes("CREATE TABLE IF NOT EXISTS subscription_plan_admin_webhook_tokens")
      )
    );
    assert.ok(
      executedQueries.some((sql) =>
        sql.includes("CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_plan_admin_webhook_tokens_plan_id")
      )
    );
    assert.ok(
      executedQueries.some((sql) =>
        sql.includes("CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_plan_admin_webhook_tokens_token")
      )
    );
    assert.ok(
      executedQueries.some((sql) =>
        sql.includes("INSERT INTO subscription_plan_admin_webhook_tokens (plan_id, token)")
      )
    );
  } finally {
    restoreQuery();
    restoreGetRepository();
  }
});

test("SubscriptionPlanDBService lazily creates, rotates, and resolves plan admin webhook tokens from the new table", async () => {
  const plans = [{ id: 45, isActive: true }];
  const tokens: any[] = [];

  const planRepo = {
    async findOne(options: any) {
      const planId = Number(options?.where?.id);
      return plans.find((plan) => Number(plan.id) === planId) ?? null;
    },
  };

  const tokenRepo = {
    create(payload: any) {
      return {
        id: payload.id ?? tokens.length + 1,
        planId: Number(payload.planId),
        token: payload.token,
        createdAt: payload.createdAt ?? new Date("2026-04-03T00:00:00.000Z"),
        updatedAt: payload.updatedAt ?? new Date("2026-04-03T00:00:00.000Z"),
      };
    },
    async findOne(options: any) {
      if (options?.where?.planId !== undefined) {
        return (
          tokens.find((row) => Number(row.planId) === Number(options.where.planId)) ?? null
        );
      }
      if (options?.where?.token !== undefined) {
        return tokens.find((row) => row.token === options.where.token) ?? null;
      }
      return null;
    },
    async save(row: any) {
      const existingIndex = tokens.findIndex((tokenRow) => Number(tokenRow.id) === Number(row.id));
      const next = {
        ...row,
        updatedAt: row.updatedAt ?? new Date("2026-04-03T00:00:00.000Z"),
      };

      if (existingIndex >= 0) {
        tokens[existingIndex] = next;
      } else {
        tokens.push(next);
      }

      return next;
    },
    createQueryBuilder() {
      const state: { token?: string } = {};

      return {
        leftJoinAndSelect() {
          return this;
        },
        where(_sql: string, params: any) {
          state.token = params.token;
          return this;
        },
        andWhere() {
          return this;
        },
        async getOne() {
          const row = tokens.find((tokenRow) => tokenRow.token === state.token);
          if (!row) return null;

          return {
            ...row,
            plan: plans.find((plan) => Number(plan.id) === Number(row.planId)) ?? null,
          };
        },
      };
    },
  };

  const restoreGetRepository = patch(AppDataSource, "getRepository", (entity: any) => {
    if (entity === SubscriptionPlan) return planRepo;
    if (entity === PlanAdminWebhookToken) return tokenRepo;
    return {};
  });

  try {
    const service = new SubscriptionPlanDBService();

    const firstToken = await service.getAdminWebhookToken(45);
    const secondToken = await service.getAdminWebhookToken(45);

    assert.equal(typeof firstToken, "string");
    assert.equal(firstToken.length, 48);
    assert.equal(secondToken, firstToken);
    assert.equal(tokens.length, 1);

    const resolvedPlan = await service.findPlanByAdminWebhookToken(firstToken);
    assert.equal(Number(resolvedPlan?.id), 45);

    const rotatedToken = await service.rotateAdminWebhookToken(45);
    assert.equal(typeof rotatedToken, "string");
    assert.notEqual(rotatedToken, firstToken);
    assert.equal(tokens.length, 1);

    const oldLookup = await service.findPlanByAdminWebhookToken(firstToken);
    const newLookup = await service.findPlanByAdminWebhookToken(rotatedToken);

    assert.equal(oldLookup, null);
    assert.equal(Number(newLookup?.id), 45);
  } finally {
    restoreGetRepository();
  }
});
