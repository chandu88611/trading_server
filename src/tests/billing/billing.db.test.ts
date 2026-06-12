import test from "node:test";
import assert from "node:assert/strict";

const AppDataSource = require("../../db/data-source").default;
const { BillingDBService } = require("../../app/billing/services/billing.db");
const { ReferralRewardCredit } = require("../../entity/ReferralRewardCredit");
const { WithdrawalRequest } = require("../../entity/WithdrawalRequest");
const { WithdrawalSetting } = require("../../entity/WithdrawalSetting");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

test("BillingDBService.ensureSchema creates referral reward, withdrawal, and payout hardening tables safely", async () => {
  const executedQueries: string[] = [];

  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  const restoreQuery = patch(AppDataSource, "query", async (sql: string) => {
    executedQueries.push(sql.replace(/\s+/g, " ").trim());
    return [];
  });

  try {
    const service = new BillingDBService();
    await service.ensureSchema();

    assert.ok(
      executedQueries.some((sql) =>
        sql.includes("CREATE TABLE IF NOT EXISTS razorpay_orders")
      )
    );
    assert.ok(
      executedQueries.some((sql) =>
        sql.includes("ALTER TABLE subscription_invoices ALTER COLUMN subscription_id DROP NOT NULL")
      )
    );
    assert.ok(
      executedQueries.some((sql) =>
        sql.includes("ALTER TABLE user_billing_details ADD COLUMN IF NOT EXISTS razorpay_contact_id TEXT")
      )
    );
    assert.ok(
      executedQueries.some((sql) =>
        sql.includes("CREATE TABLE IF NOT EXISTS referral_reward_credits")
      )
    );
    assert.ok(
      executedQueries.some((sql) =>
        sql.includes("CREATE TABLE IF NOT EXISTS withdrawal_requests")
      )
    );
    assert.ok(
      executedQueries.some((sql) =>
        sql.includes("CREATE TABLE IF NOT EXISTS withdrawal_settings")
      )
    );
  } finally {
    restoreQuery();
    restoreGetRepository();
  }
});

test("BillingDBService.getWalletSummary derives pending, withdrawable, locked, and withdrawn amounts from live rows", async () => {
  process.env.REFERRAL_REWARD_HOLD_DAYS = "7";

  const now = new Date();
  const credits = [
    {
      id: "1",
      beneficiaryUserId: "7",
      amountInr: "500.00",
      availableAt: new Date(now.getTime() - 60_000),
    },
    {
      id: "2",
      beneficiaryUserId: "7",
      amountInr: "300.00",
      availableAt: new Date(now.getTime() + 86_400_000),
    },
  ];

  const withdrawals = [
    {
      id: "10",
      userId: "7",
      amountInr: "100.00",
      status: "requested",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "11",
      userId: "7",
      amountInr: "150.00",
      status: "processed",
      createdAt: now,
      updatedAt: now,
    },
  ];

  const settings = {
    id: 1,
    minWithdrawalAmountInr: "500.00",
    createdAt: now,
    updatedAt: now,
  };

  const manager = {
    getRepository(entity: any) {
      if (entity === ReferralRewardCredit) {
        return {
          find: async () => credits,
        };
      }

      if (entity === WithdrawalRequest) {
        return {
          find: async () => withdrawals,
        };
      }

      if (entity === WithdrawalSetting) {
        return {
          findOne: async () => settings,
          create: (payload: any) => payload,
          save: async (payload: any) => payload,
        };
      }

      return {
        find: async () => [],
        findOne: async () => null,
        create: (payload: any) => payload,
        save: async (payload: any) => payload,
        manager,
      };
    },
  };

  const restoreGetRepository = patch(AppDataSource, "getRepository", (_entity: any) => ({
    find: async () => [],
    findOne: async () => null,
    create: (payload: any) => payload,
    save: async (payload: any) => payload,
    manager,
  }));

  try {
    const service = new BillingDBService();
    const wallet = await service.getWalletSummary(7);

    assert.deepEqual(wallet, {
      currency: "INR",
      totalEarned: 800,
      pendingRewards: 300,
      withdrawableAmount: 250,
      lockedWithdrawalAmount: 100,
      totalWithdrawn: 150,
      minWithdrawalAmount: 500,
      holdDays: 7,
    });
  } finally {
    restoreGetRepository();
  }
});

test("BillingDBService.createRazorpayCheckout rejects retired strategy plans for new subscriptions", async () => {
  const manager = {
    getRepository(entity: any) {
      if (entity?.name === "UserSubscription") {
        return {
          findOne: async () => null,
        };
      }
      if (entity?.name === "SubscriptionPlan") {
        return {
          findOne: async () => ({
            id: 200,
            planStrategies: [
              {
                strategyId: 300,
                strategy: {
                  id: 300,
                  isActive: false,
                  isDeprecated: true,
                },
              },
            ],
          }),
        };
      }
      return {
        findOne: async () => null,
        create: (payload: any) => payload,
        save: async (payload: any) => payload,
      };
    },
  };

  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({
    findOne: async () => null,
    create: (payload: any) => payload,
    save: async (payload: any) => payload,
    manager,
  }));
  const restoreTransaction = patch(AppDataSource, "transaction", async (fn: any) =>
    fn(manager)
  );

  try {
    const service = new BillingDBService();
    await assert.rejects(
      () =>
        service.createRazorpayCheckout(77, {
          id: 200,
          pricing: {
            priceInr: 100,
            currency: "INR",
            interval: "monthly",
          },
        } as any),
      (error: any) => {
        assert.equal(error.statusCode, 400);
        assert.equal(error.message, "strategy_unavailable_for_new_subscription");
        return true;
      }
    );
  } finally {
    restoreTransaction();
    restoreGetRepository();
  }
});
