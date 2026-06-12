import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

import { CoinDCXService } from "../../app/coindcx/services/coindcx.service";

test("CoinDCX: place order signs request and returns orderId", async () => {
	const originalFetch = global.fetch;
	let capturedInit: any = null;

	global.fetch = (async (_input: any, init?: any) => {
		capturedInit = init;
		return new Response(JSON.stringify({ id: "cdx-order-1" }), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	}) as any;

	const service = new CoinDCXService();
	(service as any).db = {
		async getTradingAccountById() {
			return {
				id: 901,
				userId: 44,
				accountMeta: {
					coindcx: {
						baseUrl: "https://api.coindcx.com",
						apiKey: "key-123",
						apiSecret: "secret-123",
					},
				},
			};
		},
	};

	try {
		const result = await service.placeOrder({
			userId: 44,
			tradingAccountId: 901,
			order: {
				symbol: "BTC/INR",
				side: "BUY",
				quantity: 0.01,
				orderType: "LIMIT",
				price: 100,
			},
		});

		assert.equal(result.orderId, "cdx-order-1");
		assert.ok(capturedInit?.headers?.["X-AUTH-APIKEY"] === "key-123");

		const body = JSON.parse(String(capturedInit?.body ?? "{}"));
		assert.equal(body.market, "BTCINR");
		assert.equal(body.side, "buy");
		assert.equal(body.order_type, "limit_order");
		assert.ok(Number.isFinite(Number(body.timestamp)));

		const expectedSig = crypto.createHmac("sha256", "secret-123").update(JSON.stringify(body)).digest("hex");
		assert.equal(capturedInit?.headers?.["X-AUTH-SIGNATURE"], expectedSig);
	} finally {
		global.fetch = originalFetch;
	}
});

test("CoinDCX: retries with USDT market when USD pair is invalid", async () => {
	const originalFetch = global.fetch;
	const calledMarkets: string[] = [];

	global.fetch = (async (_input: any, init?: any) => {
		const reqBody = JSON.parse(String(init?.body ?? "{}"));
		calledMarkets.push(String(reqBody?.market ?? ""));

		if (reqBody?.market === "BTCUSD") {
			return new Response(
				JSON.stringify({ code: 422, message: "Currency pair is not valid", status: "error" }),
				{ status: 422, headers: { "content-type": "application/json" } }
			);
		}

		return new Response(JSON.stringify({ id: "cdx-order-retry-ok" }), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	}) as any;

	const service = new CoinDCXService();
	(service as any).db = {
		async getTradingAccountById() {
			return {
				id: 904,
				userId: 47,
				accountMeta: {
					coindcx: {
						baseUrl: "https://api.coindcx.com",
						apiKey: "key-123",
						apiSecret: "secret-123",
					},
				},
			};
		},
	};

	try {
		const result = await service.placeOrder({
			userId: 47,
			tradingAccountId: 904,
			order: {
				symbol: "BTCUSD",
				side: "BUY",
				quantity: 1,
				orderType: "LIMIT",
				price: 100,
			},
		});

		assert.equal(result.orderId, "cdx-order-retry-ok");
		assert.deepEqual(calledMarkets.filter(Boolean), ["BTCUSD", "BTCUSDT"]);
	} finally {
		global.fetch = originalFetch;
	}
});

test("CoinDCX: normalizes prefixed symbol format", async () => {
	const originalFetch = global.fetch;
	let market = "";

	global.fetch = (async (_input: any, init?: any) => {
		const reqBody = JSON.parse(String(init?.body ?? "{}"));
		market = String(reqBody?.market ?? "");
		return new Response(JSON.stringify({ id: "cdx-order-prefixed" }), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	}) as any;

	const service = new CoinDCXService();
	(service as any).db = {
		async getTradingAccountById() {
			return {
				id: 905,
				userId: 48,
				accountMeta: {
					coindcx: {
						baseUrl: "https://api.coindcx.com",
						apiKey: "key-123",
						apiSecret: "secret-123",
					},
				},
			};
		},
	};

	try {
		const result = await service.placeOrder({
			userId: 48,
			tradingAccountId: 905,
			order: {
				symbol: "BINANCE:BTCUSDT",
				side: "BUY",
				quantity: 1,
				orderType: "LIMIT",
				price: 100,
			},
		});

		assert.equal(result.orderId, "cdx-order-prefixed");
		assert.equal(market, "BTCUSDT");
	} finally {
		global.fetch = originalFetch;
	}
});

test("CoinDCX: root symbol retries quote pairs (DOGE -> DOGEUSDT)", async () => {
	const originalFetch = global.fetch;
	const calledMarkets: string[] = [];

	global.fetch = (async (_input: any, init?: any) => {
		const reqBody = JSON.parse(String(init?.body ?? "{}"));
		calledMarkets.push(String(reqBody?.market ?? ""));

		if (reqBody?.market === "DOGE") {
			return new Response(
				JSON.stringify({ code: 422, message: "Currency pair is not valid", status: "error" }),
				{ status: 422, headers: { "content-type": "application/json" } }
			);
		}

		if (reqBody?.market === "DOGEUSDT") {
			return new Response(JSON.stringify({ id: "cdx-order-doge-usdt" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}

		return new Response(
			JSON.stringify({ code: 422, message: "Currency pair is not valid", status: "error" }),
			{ status: 422, headers: { "content-type": "application/json" } }
		);
	}) as any;

	const service = new CoinDCXService();
	(service as any).db = {
		async getTradingAccountById() {
			return {
				id: 906,
				userId: 49,
				accountMeta: {
					coindcx: {
						baseUrl: "https://api.coindcx.com",
						apiKey: "key-123",
						apiSecret: "secret-123",
					},
				},
			};
		},
	};

	try {
		const result = await service.placeOrder({
			userId: 49,
			tradingAccountId: 906,
			order: {
				symbol: "DOGE",
				side: "BUY",
				quantity: 1,
				orderType: "LIMIT",
				price: 0.12,
			},
		});

		assert.equal(result.orderId, "cdx-order-doge-usdt");
		const markets = calledMarkets.filter(Boolean);
		assert.equal(markets[0], "DOGE");
		assert.ok(markets.includes("DOGEUSDT"));
	} finally {
		global.fetch = originalFetch;
	}
});

test("CoinDCX: invalid/out-of-range limit price downgrades to market before request", async () => {
	const originalFetch = global.fetch;
	let capturedBody: any = null;

	global.fetch = (async (_input: any, init?: any) => {
		capturedBody = JSON.parse(String(init?.body ?? "{}"));
		return new Response(JSON.stringify({ id: "cdx-order-market-downgrade" }), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	}) as any;

	const service = new CoinDCXService();
	(service as any).db = {
		async getTradingAccountById() {
			return {
				id: 907,
				userId: 50,
				accountMeta: {
					coindcx: {
						baseUrl: "https://api.coindcx.com",
						apiKey: "key-123",
						apiSecret: "secret-123",
					},
				},
			};
		},
	};

	try {
		const result = await service.placeOrder({
			userId: 50,
			tradingAccountId: 907,
			order: {
				symbol: "DOGEUSDT",
				side: "BUY",
				quantity: 10,
				orderType: "LIMIT",
				price: 13859762538,
			},
		});

		assert.equal(result.orderId, "cdx-order-market-downgrade");
		assert.equal(capturedBody?.order_type, "market_order");
		assert.equal(capturedBody?.price_per_unit, undefined);
	} finally {
		global.fetch = originalFetch;
	}
});

test("CoinDCX: when limit price rejected by range, retries same market as market order", async () => {
	const originalFetch = global.fetch;
	const calls: any[] = [];

	global.fetch = (async (_input: any, init?: any) => {
		const reqBody = JSON.parse(String(init?.body ?? "{}"));
		calls.push(reqBody);

		if (reqBody?.market === "DOGE") {
			return new Response(
				JSON.stringify({ code: 422, message: "Currency pair is not valid", status: "error" }),
				{ status: 422, headers: { "content-type": "application/json" } }
			);
		}

		if (reqBody?.market === "DOGEUSDT" && reqBody?.order_type === "limit_order") {
			return new Response(
				JSON.stringify({ code: 400, message: "Price should be within range, 0.00001 and 10000000000.0", status: "error" }),
				{ status: 400, headers: { "content-type": "application/json" } }
			);
		}

		if (reqBody?.market === "DOGEUSDT" && reqBody?.order_type === "market_order") {
			return new Response(JSON.stringify({ id: "cdx-order-market-retry-ok" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}

		return new Response(JSON.stringify({ id: "unexpected" }), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	}) as any;

	const service = new CoinDCXService();
	(service as any).db = {
		async getTradingAccountById() {
			return {
				id: 908,
				userId: 51,
				accountMeta: {
					coindcx: {
						baseUrl: "https://api.coindcx.com",
						apiKey: "key-123",
						apiSecret: "secret-123",
					},
				},
			};
		},
	};

	try {
		const result = await service.placeOrder({
			userId: 51,
			tradingAccountId: 908,
			order: {
				symbol: "DOGE",
				side: "BUY",
				quantity: 10,
				orderType: "LIMIT",
				price: 9999999999,
			},
		});

		assert.equal(result.orderId, "cdx-order-market-retry-ok");
		assert.deepEqual(
			calls.filter((x) => x?.market).map((x) => [x.market, x.order_type]),
			[
				["DOGE", "limit_order"],
				["DOGEUSDT", "limit_order"],
				["DOGEUSDT", "market_order"],
			]
		);
	} finally {
		global.fetch = originalFetch;
	}
});

test("CoinDCX: precision rejection retries limit with normalized decimals", async () => {
	const originalFetch = global.fetch;
	const calls: any[] = [];

	global.fetch = (async (_input: any, init?: any) => {
		const reqBody = JSON.parse(String(init?.body ?? "{}"));
		calls.push(reqBody);

		if (reqBody?.market === "DOGEUSD") {
			return new Response(
				JSON.stringify({ code: 422, message: "Currency pair is not valid", status: "error" }),
				{ status: 422, headers: { "content-type": "application/json" } }
			);
		}

		if (reqBody?.market === "DOGEUSDT" && reqBody?.price_per_unit === "0.090484") {
			return new Response(
				JSON.stringify({ code: 400, message: "USDT precision should be 5", status: "error" }),
				{ status: 400, headers: { "content-type": "application/json" } }
			);
		}

		if (reqBody?.market === "DOGEUSDT" && reqBody?.price_per_unit === "0.09048") {
			return new Response(JSON.stringify({ id: "cdx-order-precision-ok" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}

		return new Response(JSON.stringify({ code: 500, message: "unexpected call", status: "error" }), {
			status: 500,
			headers: { "content-type": "application/json" },
		});
	}) as any;

	const service = new CoinDCXService();
	(service as any).db = {
		async getTradingAccountById() {
			return {
				id: 909,
				userId: 52,
				accountMeta: {
					coindcx: {
						baseUrl: "https://api.coindcx.com",
						apiKey: "key-123",
						apiSecret: "secret-123",
					},
				},
			};
		},
	};

	try {
		const result = await service.placeOrder({
			userId: 52,
			tradingAccountId: 909,
			order: {
				symbol: "DOGEUSD",
				side: "BUY",
				quantity: 10,
				orderType: "LIMIT",
				price: 0.090484,
			},
		});

		assert.equal(result.orderId, "cdx-order-precision-ok");
		assert.deepEqual(
			calls.filter((x) => x?.market).map((x) => [x.market, x.order_type, x.price_per_unit]),
			[
				["DOGEUSD", "limit_order", "0.090484"],
				["DOGEUSDT", "limit_order", "0.090484"],
				["DOGEUSDT", "limit_order", "0.09048"],
			]
		);
	} finally {
		global.fetch = originalFetch;
	}
});

test("CoinDCX: returns clear error when all candidate markets are invalid", async () => {
	const originalFetch = global.fetch;
	const calledMarkets: string[] = [];

	global.fetch = (async (_input: any, init?: any) => {
		const reqBody = JSON.parse(String(init?.body ?? "{}"));
		calledMarkets.push(String(reqBody?.market ?? ""));
		return new Response(
			JSON.stringify({ code: 422, message: "Currency pair is not valid", status: "error" }),
			{ status: 422, headers: { "content-type": "application/json" } }
		);
	}) as any;

	const service = new CoinDCXService();
	(service as any).db = {
		async getTradingAccountById() {
			return {
				id: 910,
				userId: 53,
				accountMeta: {
					coindcx: {
						baseUrl: "https://api.coindcx.com",
						apiKey: "key-123",
						apiSecret: "secret-123",
					},
				},
			};
		},
	};

	try {
		await assert.rejects(
			() =>
				service.placeOrder({
					userId: 53,
					tradingAccountId: 910,
					order: {
						symbol: "SPELLUSD",
						side: "BUY",
						quantity: 1,
						orderType: "LIMIT",
						price: 0.00017218,
					},
				}),
			(err: any) => {
				assert.equal(err?.message, "coindcx_no_valid_market_found");
				assert.equal(err?.data?.symbol, "SPELLUSD");
				assert.deepEqual(err?.data?.triedMarkets, ["SPELLUSD", "SPELLUSDT"]);
				return true;
			}
		);

		assert.deepEqual(calledMarkets.filter(Boolean), ["SPELLUSD", "SPELLUSDT"]);
	} finally {
		global.fetch = originalFetch;
	}
});

test("CoinDCX: missing broker credentials throws controlled error", async () => {
	const service = new CoinDCXService();

	(service as any).db = {
		async getTradingAccountById() {
			return {
				id: 902,
				userId: 45,
				accountMeta: { coindcx: { baseUrl: "https://api.coindcx.com" } },
			};
		},
	};

	await assert.rejects(
		() =>
			service.placeOrder({
				userId: 45,
				tradingAccountId: 902,
				order: {
					symbol: "ETHINR",
					side: "BUY",
					quantity: 1,
				},
			}),
		(err: any) => {
			assert.equal(err?.message, "coindcx_credentials_missing");
			return true;
		}
	);
});

test("CoinDCX: does not fallback to env api credentials", async () => {
	const originalApiKey = process.env.COINDCX_API_KEY;
	const originalApiSecret = process.env.COINDCX_API_SECRET;

	process.env.COINDCX_API_KEY = "env-key-should-not-be-used";
	process.env.COINDCX_API_SECRET = "env-secret-should-not-be-used";

	const service = new CoinDCXService();
	(service as any).db = {
		async getTradingAccountById() {
			return {
				id: 903,
				userId: 46,
				accountMeta: { coindcx: { baseUrl: "https://api.coindcx.com" } },
			};
		},
	};

	try {
		await assert.rejects(
			() =>
				service.placeOrder({
					userId: 46,
					tradingAccountId: 903,
					order: {
						symbol: "BTCINR",
						side: "BUY",
						quantity: 1,
					},
				}),
			(err: any) => {
				assert.equal(err?.message, "coindcx_credentials_missing");
				return true;
			}
		);
	} finally {
		if (originalApiKey === undefined) delete process.env.COINDCX_API_KEY;
		else process.env.COINDCX_API_KEY = originalApiKey;
		if (originalApiSecret === undefined) delete process.env.COINDCX_API_SECRET;
		else process.env.COINDCX_API_SECRET = originalApiSecret;
	}
});

test("CoinDCX: public ticker supports market filter", async () => {
	const originalFetch = global.fetch;

	global.fetch = (async () =>
		new Response(
			JSON.stringify([
				{ market: "BTCINR", last_price: "100" },
				{ market: "ETHINR", last_price: "50" },
			]),
			{
				status: 200,
				headers: { "content-type": "application/json" },
			}
		)) as any;

	const service = new CoinDCXService();
	try {
		const data = await service.getPublicTicker({ market: "BTC/INR" });
		assert.equal(Array.isArray(data), true);
		assert.equal((data as any[]).length, 1);
		assert.equal((data as any[])[0].market, "BTCINR");
	} finally {
		global.fetch = originalFetch;
	}
});

test("CoinDCX: public orderbook sends pair query", async () => {
	const originalFetch = global.fetch;
	let capturedInput = "";

	global.fetch = (async (input: any) => {
		capturedInput = String(input ?? "");
		return new Response(JSON.stringify({ bids: [], asks: [] }), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	}) as any;

	const service = new CoinDCXService();
	try {
		const data = await service.getPublicOrderbook({ market: "BTC/INR" });
		assert.equal(typeof data, "object");
		assert.ok(capturedInput.includes("pair=BTC_INR"));
	} finally {
		global.fetch = originalFetch;
	}
});
