import test from "node:test";
import assert from "node:assert/strict";

const AppDataSource = require("../../db/data-source").default;
const { UserDBService } = require("../../app/user/services/user.db");
const { User } = require("../../entity/User");
const { UserTradingAccount } = require("../../entity/UserTradingAccount");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

test("UserDBService.ensureSchema creates referral columns, indexes, and self-reference constraint", async () => {
  const executedQueries: string[] = [];

  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreQuery = patch(AppDataSource, "query", async (sql: string) => {
    executedQueries.push(sql.replace(/\s+/g, " ").trim());
    if (sql.includes("SELECT COUNT(*)::int AS admin_count")) {
      return [{ admin_count: 0 }];
    }
    return [];
  });

  try {
    const service = new UserDBService();
    await service.ensureSchema();

    assert.ok(
      executedQueries.some((sql) =>
        sql.includes("ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT")
      )
    );
    assert.ok(
      executedQueries.some((sql) =>
        sql.includes("ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id INT")
      )
    );
    assert.ok(
      executedQueries.some(
        (sql) =>
          sql.includes("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_referral_code_nonnull") &&
          sql.includes("WHERE referral_code IS NOT NULL")
      )
    );
    assert.ok(
      executedQueries.some((sql) =>
        sql.includes("CREATE INDEX IF NOT EXISTS idx_users_referred_by_user_id")
      )
    );
    assert.ok(
      executedQueries.some(
        (sql) =>
          sql.includes("ADD CONSTRAINT fk_users_referred_by_user_id") &&
          sql.includes("FOREIGN KEY (referred_by_user_id)") &&
          sql.includes("ON DELETE SET NULL")
      )
    );
    assert.ok(
      executedQueries.some(
        (sql) =>
          sql.includes("CREATE TABLE IF NOT EXISTS user_risk_limits") &&
          sql.includes("daily_loss_limit NUMERIC(15, 2)") &&
          sql.includes("cooldown_after_loss_mins INT")
      )
    );
    assert.ok(
      executedQueries.some(
        (sql) =>
          sql.includes(
            "CREATE TABLE IF NOT EXISTS admin_strategy_trade_schedule_settings"
          ) &&
          sql.includes("timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata'") &&
          sql.includes("windows JSONB NOT NULL DEFAULT '[]'::jsonb")
      )
    );
    assert.ok(
      executedQueries.some(
        (sql) =>
          sql.includes(
            "INSERT INTO admin_strategy_trade_schedule_settings (id, is_enabled, timezone, windows)"
          ) &&
          sql.includes("VALUES (1, FALSE, 'Asia/Kolkata', '[]'::jsonb)")
      )
    );
  } finally {
    restoreQuery();
    restoreGetRepository();
  }
});

test("UserDBService.updateTradeStatus updates the user flag and all owned trading accounts in one transaction", async () => {
  const state = {
    user: {
      id: 7,
      allowTrade: true,
    },
    accounts: [
      { id: 101, userId: 7, isEnabled: true },
      { id: 102, userId: 7, isEnabled: true },
      { id: 103, userId: 9, isEnabled: true },
    ],
  };

  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreTransaction = patch(
    AppDataSource,
    "transaction",
    async (callback: (manager: any) => Promise<any>) => {
      const workingState = {
        user: { ...state.user },
        accounts: state.accounts.map((account) => ({ ...account })),
      };
      let targetUserId: number | null = null;
      let nextIsEnabled = true;

      const manager = {
        getRepository(entity: any) {
          if (entity === User) {
            return {
              findOne: async ({ where: { id } }: { where: { id: number } }) =>
                workingState.user.id === id ? workingState.user : null,
              save: async (user: { id: number; allowTrade: boolean }) => {
                workingState.user = { ...workingState.user, ...user };
                return workingState.user;
              },
            };
          }

          if (entity === UserTradingAccount) {
            const queryBuilder = {
              update: () => queryBuilder,
              set: ({ isEnabled }: { isEnabled: boolean }) => {
                nextIsEnabled = isEnabled;
                return queryBuilder;
              },
              where: (_sql: string, params: { userId: number }) => {
                targetUserId = params.userId;
                return queryBuilder;
              },
              execute: async () => {
                workingState.accounts = workingState.accounts.map((account) =>
                  account.userId === targetUserId
                    ? { ...account, isEnabled: nextIsEnabled }
                    : account
                );
                return { affected: workingState.accounts.length };
              },
            };

            return {
              createQueryBuilder: () => queryBuilder,
            };
          }

          throw new Error("Unexpected repository access");
        },
      };

      const result = await callback(manager);
      state.user = workingState.user;
      state.accounts = workingState.accounts;
      return result;
    }
  );

  try {
    const service = new UserDBService();
    const updatedUser = await service.updateTradeStatus(7, false);

    assert.equal(updatedUser.allowTrade, false);
    assert.equal(state.user.allowTrade, false);
    assert.deepEqual(
      state.accounts.map((account) => ({
        id: account.id,
        userId: account.userId,
        isEnabled: account.isEnabled,
      })),
      [
        { id: 101, userId: 7, isEnabled: false },
        { id: 102, userId: 7, isEnabled: false },
        { id: 103, userId: 9, isEnabled: true },
      ]
    );
  } finally {
    restoreTransaction();
    restoreGetRepository();
  }
});

test("UserDBService.updateTradeStatus leaves user and account state unchanged when the transaction fails", async () => {
  const state = {
    user: {
      id: 12,
      allowTrade: true,
    },
    accounts: [
      { id: 201, userId: 12, isEnabled: true },
      { id: 202, userId: 12, isEnabled: true },
    ],
  };

  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreTransaction = patch(
    AppDataSource,
    "transaction",
    async (callback: (manager: any) => Promise<any>) => {
      const workingState = {
        user: { ...state.user },
        accounts: state.accounts.map((account) => ({ ...account })),
      };
      let targetUserId: number | null = null;
      let nextIsEnabled = true;

      const manager = {
        getRepository(entity: any) {
          if (entity === User) {
            return {
              findOne: async ({ where: { id } }: { where: { id: number } }) =>
                workingState.user.id === id ? workingState.user : null,
              save: async (user: { id: number; allowTrade: boolean }) => {
                workingState.user = { ...workingState.user, ...user };
                return workingState.user;
              },
            };
          }

          if (entity === UserTradingAccount) {
            const queryBuilder = {
              update: () => queryBuilder,
              set: ({ isEnabled }: { isEnabled: boolean }) => {
                nextIsEnabled = isEnabled;
                return queryBuilder;
              },
              where: (_sql: string, params: { userId: number }) => {
                targetUserId = params.userId;
                return queryBuilder;
              },
              execute: async () => {
                workingState.accounts = workingState.accounts.map((account) =>
                  account.userId === targetUserId
                    ? { ...account, isEnabled: nextIsEnabled }
                    : account
                );
                throw new Error("bulk_account_update_failed");
              },
            };

            return {
              createQueryBuilder: () => queryBuilder,
            };
          }

          throw new Error("Unexpected repository access");
        },
      };

      const result = await callback(manager);
      state.user = workingState.user;
      state.accounts = workingState.accounts;
      return result;
    }
  );

  try {
    const service = new UserDBService();

    await assert.rejects(
      () => service.updateTradeStatus(12, false),
      /bulk_account_update_failed/
    );

    assert.equal(state.user.allowTrade, true);
    assert.deepEqual(state.accounts, [
      { id: 201, userId: 12, isEnabled: true },
      { id: 202, userId: 12, isEnabled: true },
    ]);
  } finally {
    restoreTransaction();
    restoreGetRepository();
  }
});
