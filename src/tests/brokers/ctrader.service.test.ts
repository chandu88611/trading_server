import test from "node:test";
import assert from "node:assert/strict";

import { CTraderService } from "../../app/cTraderListener/services/cTrader";

test("cTrader: checkConnection healthy JSON response", async () => {
  const originalFetch = global.fetch;

  global.fetch = (async () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as any;

  try {
    const service = new CTraderService({ baseUrl: "http://fake-gw", timeoutMs: 1000 });
    const result = await service.checkConnection();

    assert.equal(result.ok, true);
    assert.equal(result.status, 200);
    assert.equal(result.url, "http://fake-gw/health");
  } finally {
    global.fetch = originalFetch;
  }
});

test("cTrader: exchangeOAuthCode validates missing input", async () => {
  const service = new CTraderService({ baseUrl: "http://fake-gw", timeoutMs: 1000 });

  const missingUser = await service.exchangeOAuthCode("", "code-1");
  const missingCode = await service.exchangeOAuthCode(123, "");

  assert.equal(missingUser.ok, false);
  assert.equal(missingUser.error, "missing_userId");

  assert.equal(missingCode.ok, false);
  assert.equal(missingCode.error, "missing_code");
});

test("cTrader: execute trade handles gateway proto error response", async () => {
  const originalFetch = global.fetch;

  global.fetch = (async () =>
    new Response(
      JSON.stringify({
        response: { payloadType: "PROTO_OA_ERROR_RES", payload: { reason: "no_account_auth" } },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    )) as any;

  try {
    const service = new CTraderService({ baseUrl: "http://fake-gw", timeoutMs: 1000 });

    const result = await service.exectuteTradeSignalApiCall({
      userId: 99,
      symbol: "EURUSD",
      side: "BUY",
      qty: 1000,
      accountId: 46021074,
    });

    assert.equal(result.ok, false);
    assert.equal(result.error, "ctrader_proto_error_res");
    assert.equal(result.status, 200);
  } finally {
    global.fetch = originalFetch;
  }
});
