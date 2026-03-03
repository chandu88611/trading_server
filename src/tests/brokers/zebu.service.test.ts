import test from "node:test";
import assert from "node:assert/strict";

import { ZebuService } from "../../app/zebu/services/zebu.service";
import { TradingAccountStatus } from "../../app/subscriptionPlan/enums/subscriberPlan.enum";

test("Zebu: generate token and persist metadata", async () => {
  const originalFetch = global.fetch;
  const fetchCalls: Array<{ input: any; init?: any }> = [];

  global.fetch = (async (input: any, init?: any) => {
    fetchCalls.push({ input, init });
    return new Response(
      JSON.stringify({ stat: "Ok", susertoken: "zebu-token-123" }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  }) as any;

  const service = new ZebuService();
  const persisted: any[] = [];

  const fakeAccount: any = {
    id: 55,
    userId: 20,
    status: TradingAccountStatus.PENDING,
    accountId: "ZEBU-ACCT-1",
    accountMeta: {
      zebu: {
        clientId: "zcid-1",
        apiKey: "zkey-1",
        apiSecret: "zsecret-1",
        baseUrl: "https://zebu.mock",
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
      userId: 20,
      tradingAccountId: 55,
      password: "myPass",
      totp: "654321",
    });

    assert.equal(result.ok, true);
    assert.equal(result.tokenStored, true);
    assert.equal(fakeAccount.status, TradingAccountStatus.VERIFIED);
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].nextMeta.zebu.accessToken, "zebu-token-123");
    assert.equal(fetchCalls.length, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test("Zebu: missing broker credentials throws controlled error", async () => {
  const service = new ZebuService();

  (service as any).db = {
    async getTradingAccountById() {
      return {
        id: 56,
        userId: 21,
        status: TradingAccountStatus.PENDING,
        accountMeta: { zebu: { baseUrl: "https://zebu.mock" } },
      };
    },
    async updateAccountMeta() {
      throw new Error("should_not_persist");
    },
  };

  await assert.rejects(
    () =>
      service.generateAndSaveTokenUsingTotp({
        userId: 21,
        tradingAccountId: 56,
        password: "myPass",
        totp: "654321",
      }),
    (err: any) => {
      assert.equal(err?.message, "zebu_credentials_missing");
      return true;
    }
  );
});
