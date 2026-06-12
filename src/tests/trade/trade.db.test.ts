import test from "node:test";
import assert from "node:assert/strict";

const AppDataSource = require("../../db/data-source").default;
const { TradeDBService } = require("../../app/trade/services/trade.db");
const {
  AdminStrategyTrade,
  TradeSignal,
  TradeSignalStatus,
} = require("../../entity");

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

test("TradeDBService: closeAdminStrategyTrade queues only completed linked user trades", async () => {
  const restoreGetRepository = patch(AppDataSource, "getRepository", () => ({}));
  let tradeSignalQueryCount = 0;
  let statusUpdateSet: any = null;
  let statusUpdateWhere: any = null;
  let adminUpdate: any = null;

  const queryRunner = {
    manager: {
      getRepository(entity: any) {
        if (entity === AdminStrategyTrade) {
          return {
            async findOne() {
              return {
                id: 900,
                closeQueuedCount: 1,
                status: "fanned_out",
              };
            },
            async update(where: any, set: any) {
              adminUpdate = { where, set };
              return { affected: 1 };
            },
          };
        }

        if (entity === TradeSignal) {
          tradeSignalQueryCount += 1;
          if (tradeSignalQueryCount === 1) {
            return {
              createQueryBuilder() {
                return {
                  where() {
                    return this;
                  },
                  async getCount() {
                    return 3;
                  },
                };
              },
            };
          }

          return {
            createQueryBuilder() {
              return {
                innerJoin() {
                  return this;
                },
                where() {
                  return this;
                },
                andWhere() {
                  return this;
                },
                select() {
                  return this;
                },
                async getMany() {
                  return [{ id: 11 }, { id: 12 }];
                },
              };
            },
          };
        }

        if (entity === TradeSignalStatus) {
          return {
            createQueryBuilder() {
              return {
                update() {
                  return this;
                },
                set(value: any) {
                  statusUpdateSet = value;
                  return this;
                },
                where(sql: string, params: any) {
                  statusUpdateWhere = { sql, params };
                  return this;
                },
                andWhere() {
                  return this;
                },
                async execute() {
                  return { affected: 2 };
                },
              };
            },
          };
        }

        throw new Error("unexpected_repository");
      },
    },
  };

  try {
    const db = new TradeDBService();
    const result = await db.closeAdminStrategyTrade(900, queryRunner as any);

    assert.deepEqual(result, {
      adminStrategyTradeId: 900,
      queuedCloseCount: 2,
      skippedCount: 1,
      signalIds: [11, 12],
    });
    assert.equal(statusUpdateSet.status, "pending_close");
    assert.deepEqual(statusUpdateWhere.params, { signalIds: [11, 12] });
    assert.deepEqual(adminUpdate.where, { id: 900 });
    assert.equal(adminUpdate.set.closeQueuedCount, 3);
    assert.equal(adminUpdate.set.status, "close_requested");
  } finally {
    restoreGetRepository();
  }
});
