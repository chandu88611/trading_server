import test from "node:test";
import assert from "node:assert/strict";

const AppDataSource = require("../../db/data-source").default;

function patch(target: any, key: string, value: any) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

test("StrategyDBService: create validates and normalizes strategy catalog fields", async () => {
  let savedRow: any = null;
  let saveImpl = async (row: any) => {
    savedRow = row;
    return { id: 1, ...row };
  };
  const strategyRepo = {
    create(row: any) {
      return row;
    },
    save(row: any) {
      return saveImpl(row);
    },
  };
  const restoreGetRepository = patch(AppDataSource, "getRepository", (entity: any) => {
    if (entity?.name === "Strategy") return strategyRepo;
    return {};
  });

  try {
    const { StrategyDBService } = require("../../app/strategy/strategy.db");
    const db = new StrategyDBService();

    const created = await db.create({
      strategyCode: "Mean Reversion ++",
      name: "Mean Reversion",
      category: "forex",
      version: "2",
      defaultParams: '{"risk":"medium"}',
      capitalRequirement: "1200",
      isActive: "true",
      isDeprecated: false,
      isCopyable: true,
    });

    assert.equal(created.id, 1);
    assert.equal(savedRow.strategyCode, "MEAN_REVERSION");
    assert.equal(savedRow.version, 2);
    assert.deepEqual(savedRow.defaultParams, { risk: "medium" });
    assert.equal(savedRow.capitalRequirement, "1200.00");

    saveImpl = async () => {
      throw { code: "23505" };
    };
    await assert.rejects(
      () =>
        db.create({
          name: "Duplicate",
          category: "forex",
        }),
      (error: any) => {
        assert.equal(error.statusCode, 409);
        assert.equal(error.message, "strategy_code_already_exists");
        return true;
      }
    );
  } finally {
    restoreGetRepository();
  }
});

test("StrategyDBService: update changes catalog only and does not touch user instances", async () => {
  let savedRow: any = null;
  let userStrategySaveCount = 0;
  const existing = {
    id: 7,
    strategyCode: "OLD",
    name: "Old",
    description: null,
    category: "forex",
    version: 1,
    defaultParams: {},
    riskProfile: null,
    capitalRequirement: null,
    isActive: true,
    isDeprecated: false,
    isCopyable: true,
  };
  const strategyRepo = {
    async findOne() {
      return existing;
    },
    async save(row: any) {
      savedRow = row;
      return row;
    },
  };
  const userStrategyRepo = {
    async save() {
      userStrategySaveCount += 1;
    },
  };
  const restoreGetRepository = patch(AppDataSource, "getRepository", (entity: any) => {
    if (entity?.name === "Strategy") return strategyRepo;
    if (entity?.name === "UserStrategyInstance") return userStrategyRepo;
    return {};
  });

  try {
    const { StrategyDBService } = require("../../app/strategy/strategy.db");
    const db = new StrategyDBService();

    const updated = await db.update(7, {
      strategyCode: "New Code",
      version: 3,
      defaultParams: { mode: "future" },
      capitalRequirement: 2500,
    });

    assert.equal(updated.strategyCode, "NEW_CODE");
    assert.equal(savedRow.version, 3);
    assert.deepEqual(savedRow.defaultParams, { mode: "future" });
    assert.equal(savedRow.capitalRequirement, "2500.00");
    assert.equal(userStrategySaveCount, 0);
  } finally {
    restoreGetRepository();
  }
});

test("StrategyDBService: retire soft-deletes strategy catalog rows", async () => {
  let capturedParams: any[] = [];
  const strategyRepo = {
    manager: {
      async query(_sql: string, params: any[]) {
        capturedParams = params;
        return [
          {
            id: params[0],
            strategy_code: "OLD",
            is_active: false,
            is_deprecated: true,
          },
        ];
      },
    },
  };
  const restoreGetRepository = patch(AppDataSource, "getRepository", (entity: any) => {
    if (entity?.name === "Strategy") return strategyRepo;
    return {};
  });

  try {
    const { StrategyDBService } = require("../../app/strategy/strategy.db");
    const db = new StrategyDBService();
    const retired = await db.retire(9);

    assert.deepEqual(capturedParams, [9]);
    assert.equal(retired.is_active, false);
    assert.equal(retired.is_deprecated, true);
  } finally {
    restoreGetRepository();
  }
});

test("StrategyDBService: setUserStrategyInstanceVolume enforces range and saves normalized value", async () => {
  const savedRows: any[] = [];
  const userStrategyRepo = {
    async findOne() {
      return {
        id: 5,
        userId: 77,
        volume: "0.01",
        strategy: {
          id: 99,
          strategyCode: "ALGO_1",
          name: "Algo 1",
          isActive: true,
        },
      };
    },
    async save(row: any) {
      savedRows.push(row);
      return row;
    },
  };

  const restoreGetRepository = patch(AppDataSource, "getRepository", (entity: any) => {
    if (entity?.name === "UserStrategyInstance") return userStrategyRepo;
    return {};
  });

  try {
    const { StrategyDBService } = require("../../app/strategy/strategy.db");
    const db = new StrategyDBService();

    const updated = await db.setUserStrategyInstanceVolume(77, 5, 0.05);
    assert.equal(updated.volume, "0.05");
    assert.equal(savedRows[0].volume, "0.05");

    await assert.rejects(
      () => db.setUserStrategyInstanceVolume(77, 5, 0.11),
      (error: any) => {
        assert.equal(error.statusCode, 400);
        assert.equal(error.message, "volume_must_be_between_0.01_and_0.1");
        return true;
      }
    );
  } finally {
    restoreGetRepository();
  }
});

test("StrategyDBService: setUserStrategyStatusByStrategyId updates the caller's active instance", async () => {
  const savedRows: any[] = [];
  const instances = [
    {
      id: 8,
      userId: 77,
      strategyId: 101,
      status: "paused",
      pausedAt: new Date("2026-04-01T00:00:00.000Z"),
      stoppedAt: new Date("2026-04-01T00:10:00.000Z"),
      strategy: {
        id: 101,
        strategyCode: "ALGO_2",
        name: "Algo 2",
        isActive: true,
      },
      subscription: {
        id: 50,
        statusV2: "active",
      },
    },
  ];

  const fakeQueryBuilder = {
    leftJoinAndSelect() {
      return this;
    },
    innerJoinAndSelect() {
      return this;
    },
    where() {
      return this;
    },
    andWhere() {
      return this;
    },
    orderBy() {
      return this;
    },
    async getMany() {
      return instances;
    },
  };

  const userStrategyRepo = {
    createQueryBuilder() {
      return fakeQueryBuilder;
    },
    async save(rows: any[]) {
      savedRows.push(...rows);
      return rows;
    },
  };

  const restoreGetRepository = patch(AppDataSource, "getRepository", (entity: any) => {
    if (entity?.name === "UserStrategyInstance") return userStrategyRepo;
    return {};
  });

  try {
    const { StrategyDBService } = require("../../app/strategy/strategy.db");
    const db = new StrategyDBService();

    const updated = await db.setUserStrategyStatusByStrategyId(77, 101, "active");
    assert.equal(updated.status, "active");
    assert.equal(updated.pausedAt, null);
    assert.equal(updated.stoppedAt, null);
    assert.equal(savedRows[0].status, "active");
  } finally {
    restoreGetRepository();
  }
});
