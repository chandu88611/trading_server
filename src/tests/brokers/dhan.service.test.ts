import test from "node:test";
import assert from "node:assert/strict";

import { DhanService } from "../../app/dhan/services/dhan.service";
import { TradingAccountStatus } from "../../app/subscriptionPlan/enums/subscriberPlan.enum";

test("Dhan: generate token and persist metadata", async () => {
  const originalFetch = global.fetch;

  global.fetch = (async () =>
    new Response(
      JSON.stringify({ data: { access_token: "dhan-token-123", refresh_token: "dhan-refresh", expires_at: "2030-01-01T00:00:00Z" } }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    )) as any;

  const service = new DhanService();
  const persisted: any[] = [];

  const fakeAccount: any = {
    id: 45,
    userId: 10,
    status: TradingAccountStatus.PENDING,
    accountId: "DHAN-ACCT-1",
    accountMeta: {
      dhan: {
        clientId: "cid-1",
        apiKey: "key-1",
        apiSecret: "secret-1",
        baseUrl: "https://dhan.mock",
      },
    },
  };

  (service as any).db = {
    async getTradingAccountById() {
      return fakeAccount;
    },
    async updateAccountMeta(account: any, nextMeta: any) {
      persisted.push({ account, nextMeta });
    },
  };

  try {
    const result = await service.generateAndSaveTokenUsingTotp({
      userId: 10,
      tradingAccountId: 45,
      totp: "123456",
    });

    assert.equal(result.ok, true);
    assert.equal(result.tokenStored, true);
    assert.equal(fakeAccount.status, TradingAccountStatus.VERIFIED);
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].nextMeta.dhan.accessToken, "dhan-token-123");
  } finally {
    global.fetch = originalFetch;
  }
});

test("Dhan: missing broker credentials throws controlled error", async () => {
  const service = new DhanService();

  (service as any).db = {
    async getTradingAccountById() {
      return {
        id: 46,
        userId: 11,
        status: TradingAccountStatus.PENDING,
        accountMeta: { dhan: { baseUrl: "https://dhan.mock" } },
      };
    },
    async updateAccountMeta() {
      throw new Error("should_not_persist");
    },
  };

  await assert.rejects(
    () =>
      service.generateAndSaveTokenUsingTotp({
        userId: 11,
        tradingAccountId: 46,
        totp: "123456",
      }),
    (err: any) => {
      assert.equal(err?.message, "dhan_credentials_missing");
      return true;
    }
  );
});
