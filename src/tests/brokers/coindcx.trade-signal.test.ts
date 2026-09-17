import assert from "node:assert/strict";
import test from "node:test";
import { CoinDCXService } from "../../app/coindcx/services/coindcx.service";
import { CoinDCXDB } from "../../app/coindcx/services/coindcx.db";
import { TradingAccountStatus } from "../../app/subscriptionPlan/enums/subscriberPlan.enum";

test("CoinDCX maps persisted TradeSignal fields to spot orders", () => {
	const service = new CoinDCXService() as any;
	const market = service.buildOrderFromTradeSignal({
		id: 7, symbol: "BTCINR", action: "BUY", volume: "0.25",
		price: "80000", limitPrice: null, orderType: "market_order",
		stopLoss: "75000", takeProfit: "90000",
	});
	assert.equal(market.side, "BUY");
	assert.equal(market.quantity, 0.25);
	assert.equal(market.price, undefined);
	assert.equal(market.clientOrderId, "trade_signal_7");
	assert.equal(market.stopLoss, 75000);
	assert.equal(market.takeProfit, 90000);

	const limit = service.buildOrderFromTradeSignal({
		id: 8, symbol: "BTCINR", action: "SELL", volume: "0.5",
		price: "80000", limitPrice: "79000", orderType: "limit_order",
	});
	assert.equal(limit.side, "SELL");
	assert.equal(limit.quantity, 0.5);
	assert.equal(limit.price, 79000);
	assert.throws(() => service.buildOrderFromTradeSignal({
		id: 9, symbol: "BTCINR", action: "BUY", volume: "0.5",
		price: "80000", limitPrice: null, orderType: "limit_order",
	}), { message: "limit_price_required" });
});

test("CoinDCX extracts real order IDs from array responses", () => {
	const service = new CoinDCXService() as any;
	assert.equal(service.extractBrokerOrderId([{ id: "broker-1" }]), "broker-1");
	assert.equal(service.extractBrokerOrderId({ client_order_id: "client-only" }), null);
	assert.equal(service.extractBrokerOrderId({ data: [{ id: "broker-2" }] }), "broker-2");
});

test("CoinDCX verification persists runner-visible status and timestamp", async () => {
	const service = new CoinDCXService() as any;
	const account = {
		id: 11, userId: 3, broker: { code: "COINDCX" },
		accountMeta: { coindcx: { apiKey: "key", apiSecret: "secret" } },
	};
	let verification: any;
	service.db.getTradingAccountById = async () => account;
	service.db.updateAccountMeta = async (_account: any, _patch: any, value: any) => {
		verification = value;
	};
	service.privatePost = async () => [];
	const result = await service.verifyAuthToken(3, 11);
	assert.equal(result.valid, true);
	assert.equal(verification.status, TradingAccountStatus.VERIFIED);
	assert.equal(verification.checkedAt.toISOString(), result.checkedAt);
});

test("CoinDCX runner rejects non-CoinDCX jobs before placing an order", async () => {
	const service = new CoinDCXService() as any;
	const job = { id: 12, tradingAccount: { id: 5, userId: 3, broker: { code: "ZEBU" } } };
	let placed = false;
	let failed = "";
	service.db.claimPendingTrades = async () => [job];
	service.db.markJobFailed = async (_job: any, reason: string) => { failed = reason; };
	service.placeOrder = async () => { placed = true; };
	const result = await service.executePendingBatch({ batchSize: 1 });
	assert.equal(placed, false);
	assert.equal(result.failed, 1);
	assert.equal(failed, "trade_signal_broker_not_coindcx");
});

test("CoinDCX account lookup is broker-scoped and disconnect clears verification", async () => {
	const db = new CoinDCXDB() as any;
	let lookup: any;
	db.accountRepo = {
		findOne: async (query: any) => { lookup = query; return null; },
		save: async (account: any) => account,
	};
	await db.getTradingAccountById(3, 11);
	assert.deepEqual(lookup.where, [
		{ id: 11, userId: 3, broker: { code: "COINDCX" } },
		{ id: 11, userId: 3, broker: { name: "CoinDCX" } },
	]);

	const account: any = {
		status: TradingAccountStatus.VERIFIED,
		lastVerifiedAt: new Date(),
		accountMeta: { coindcx: { apiKey: "key", apiSecret: "secret" } },
	};
	await db.clearAuthMeta(account);
	assert.equal(account.status, TradingAccountStatus.PENDING);
	assert.equal(account.lastVerifiedAt, null);
	assert.equal(account.accountMeta.coindcx, undefined);
});
