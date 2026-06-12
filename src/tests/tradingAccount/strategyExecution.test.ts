import test from "node:test";
import assert from "node:assert/strict";

const AppDataSource = require("../../db/data-source").default;
const { TradingAccountDBService } = require("../../app/tradingAccount/services/tradingAccount.db");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

test("TradingAccountDBService: resolveStrategyExecutionTargets includes verified non-master subscription accounts", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", (entity: any) => {
    if (entity?.name === "UserTradingAccount") {
      return {
        async find(args: any) {
          if (args?.where?.subscriptionId === 23) {
            return [
              {
                id: 49,
                userId: 9,
                isMaster: false,
              },
            ];
          }
          return [];
        },
      };
    }
    if (entity?.name === "CopyTradingMaster") {
      return {
        async find() {
          return [];
        },
      };
    }
    if (entity?.name === "CopyTradingFollowers") {
      return {
        async find() {
          return [];
        },
      };
    }
    throw new Error(`unexpected repository request: ${entity?.name}`);
  });

  try {
    const service = new TradingAccountDBService();
    const result = await service.resolveStrategyExecutionTargets(9, 23, [3]);

    assert.deepEqual(result, {
      accounts: [{ userId: 9, id: 49 }],
      eligibleOwnedAccountIds: [49],
      masterAccountIds: [],
      followerAccountIds: [],
    });
  } finally {
    restoreGetRepository();
  }
});

test("TradingAccountDBService: resolveStrategyExecutionTargets preserves master follower fanout and de-duplicates targets", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", (entity: any) => {
    if (entity?.name === "UserTradingAccount") {
      return {
        async find(args: any) {
          if (args?.where?.subscriptionId === 22) {
            return [
              { id: 43, userId: 2, isMaster: true },
              { id: 44, userId: 2, isMaster: false },
            ];
          }

          return [
            { id: 50, userId: 70, isMaster: false, status: "verified", isEnabled: true },
            { id: 44, userId: 2, isMaster: false, status: "verified", isEnabled: true },
          ];
        },
      };
    }
    if (entity?.name === "CopyTradingMaster") {
      return {
        async find() {
          return [
            { masterTradingAccountId: 43, userTradingAccountId: 50, isActive: true },
            { masterTradingAccountId: 43, userTradingAccountId: 44, isActive: true },
          ];
        },
      };
    }
    if (entity?.name === "CopyTradingFollowers") {
      return {
        async find() {
          return [];
        },
      };
    }
    throw new Error(`unexpected repository request: ${entity?.name}`);
  });

  try {
    const service = new TradingAccountDBService();
    const result = await service.resolveStrategyExecutionTargets(2, 22, [3]);

    assert.deepEqual(result, {
      accounts: [
        { userId: 2, id: 43 },
        { userId: 2, id: 44 },
        { userId: 70, id: 50 },
      ],
      eligibleOwnedAccountIds: [43, 44],
      masterAccountIds: [43],
      followerAccountIds: [50, 44],
    });
  } finally {
    restoreGetRepository();
  }
});
