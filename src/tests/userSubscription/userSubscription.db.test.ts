import test from "node:test";
import assert from "node:assert/strict";

const AppDataSource = require("../../db/data-source").default;
const { UserSubscriptionDBService } = require("../../app/userSubscription/services/userSubscription.db");
const { UserSubscription } = require("../../entity/UserSubscription");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

test("UserSubscriptionDBService.ensureSchema repairs legacy status sync and active uniqueness", async () => {
  const executedQueries: string[] = [];

  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreQuery = patch(AppDataSource, "query", async (sql: string) => {
    executedQueries.push(sql.replace(/\s+/g, " ").trim());
    return [];
  });

  try {
    const service = new UserSubscriptionDBService();
    await service.ensureSchema();

    assert.ok(
      executedQueries.some((sql) => sql.includes("ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS status TEXT"))
    );
    assert.ok(
      executedQueries.some((sql) => sql.includes("SET status_v2 = status::subscription_status"))
    );
    assert.ok(
      executedQueries.some((sql) => sql.includes("SET status = status_v2::text"))
    );
    assert.ok(
      executedQueries.some((sql) => sql.includes("DROP INDEX IF EXISTS uq_user_subscriptions_id_user"))
    );
    assert.ok(
      executedQueries.some(
        (sql) =>
          sql.includes("CREATE UNIQUE INDEX IF NOT EXISTS uq_user_subscriptions_id_user") &&
          sql.includes("WHERE status_v2 = 'active'::subscription_status")
      )
    );
  } finally {
    restoreQuery();
    restoreGetRepository();
  }
});

test("UserSubscriptionDBService.createSubscription converts duplicate active plan errors to 409", async () => {
  const fakeSubRepo = {
    create(payload: any) {
      return payload;
    },
    async save() {
      throw {
        code: "23505",
        constraint: "uq_user_subscriptions_id_user",
      };
    },
  };

  const restoreGetRepository = patch(AppDataSource, "getRepository", (entity: any) => {
    if (entity === UserSubscription) {
      return fakeSubRepo;
    }
    return {};
  });

  try {
    const service = new UserSubscriptionDBService();

    await assert.rejects(
      () => service.createSubscription(4, 1, 30),
      (error: any) => {
        assert.equal(error.statusCode, 409);
        assert.equal(error.message, "User already has an active subscription for this plan");
        return true;
      }
    );
  } finally {
    restoreGetRepository();
  }
});
