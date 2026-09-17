import axios from "axios";
import test from "node:test";
import assert from "node:assert/strict";
import { CoinDCXMarketService, quantizeQuantity, quantizePrice, assertMinNotional, spotExitQuantity, prepareOrder, MarketRules } from "../../app/coindcx/services/coindcxMarket.service";
import { CoinDCXService } from "../../app/coindcx/services/coindcx.service";
import AppDataSource from "../../db/data-source";
import { TradeGuardService } from "../../app/trade/services/tradeGuard.service";
import { AlertSnapshotService } from "../../app/broker/brokerAlerts/services/alertSnapshot.service";
const rules: MarketRules = { quantityStep:0.001, tickSize:0.05,minQuantity:0.001,minNotional:5,baseAsset:"SOL",quoteAsset:"USDT" };
const account = {id:1,userId:2,broker:{code:"COINDCX"},accountMeta:{coindcx:{leverage:3}}};
function service() {
  const s = new CoinDCXService() as any;
  s.db.getTradingAccountById = async()=>account;
  s.requireCredentials = ()=>({apiKey:"fixture",apiSecret:"fixture",baseUrl:"https://invalid.test"});
  s.markets = {spot:async()=>rules,futures:async()=>rules};
  s.privatePost = async()=>{throw new Error("Unexpected broker request");};
  s.getPublicTicker = async()=>[{last_price:100,timestamp:Date.now()}];
  return s;
}
const order = {symbol:"SOLUSDT",side:"BUY",quantity:1.2349,price:100.023,orderType:"limit_order"};
test("decimal quantity floor handles exact multiples, fractional steps and scientific notation",()=>{
  assert.equal(quantizeQuantity(0.3,0.1,0.1),0.3);
  assert.equal(quantizeQuantity(1.2349,0.001,0.001),1.234);
  assert.equal(quantizeQuantity(1.999,0.25,0.25),1.75);
  assert.equal(quantizeQuantity(3e-8,1e-8,1e-8),3e-8);
  assert.throws(()=>quantizeQuantity(0.0009,0.001,0.001),/coindcx_below_min_quantity/);
  assert.throws(()=>quantizeQuantity(-1,0.1),/coindcx_invalid_decimal/);
  assert.throws(()=>quantizeQuantity(1,0),/coindcx_invalid_step/);
});
test("price rounds to nearest tick with deterministic half-up rounding",()=>{
  assert.equal(quantizePrice(100.023,0.05),100);
  assert.equal(quantizePrice(100.025,0.05),100.05);
  assert.equal(quantizePrice(1.235,0.01),1.24);
  assert.equal(quantizePrice(2.5e-8,1e-8),3e-8);
});
test("min notional checks normalized quantity, exact boundary and currency-specific minimum",()=>{
  assert.doesNotThrow(()=>assertMinNotional(0.05,100,5));
  assert.throws(()=>assertMinNotional(0.049,100,5),/coindcx_below_min_notional/);
  assert.doesNotThrow(()=>assertMinNotional(0.3,0.1,0.03));
  assert.throws(()=>prepareOrder(0.0509,99,rules),/coindcx_below_min_notional/);
});
test("fee-aware exits floor to spendable asset balance without increasing requested size",()=>{
  assert.equal(spotExitQuantity(1,0.998,0.001,0.001),0.998);
  assert.equal(spotExitQuantity(1,2,0.001,0.001),1);
  assert.equal(spotExitQuantity(1,0.9989,0.001,0.001),0.998);
  assert.throws(()=>spotExitQuantity(1,NaN,0.001,0.001),/balance_unavailable/);
  assert.throws(()=>spotExitQuantity(1,0,0.001,0.001),/below_min_quantity/);
});
test("spot metadata separates quantity step from price precision and refreshes after one hour",async()=>{
  let now=0,calls=0;
  const fetch=async()=>{calls++;return [{coindcx_name:"SOLUSDT",status:"active",step:0.001,min_quantity:0.001,min_notional:5,base_currency_precision:2,target_currency_short_name:"SOL",base_currency_short_name:"USDT"}];};
  const cache=new CoinDCXMarketService(fetch,"unit-spot",()=>now);
  const [a,b]=await Promise.all([cache.spot("SOLUSDT"),cache.spot("SOLUSDT")]);
  assert.equal(calls,1);assert.equal(a.tickSize,0.01);assert.equal(a.quantityStep,0.001);assert.deepEqual(a,b);
  now=3599999;await cache.spot("SOLUSDT");assert.equal(calls,1);
  now=3600000;await cache.spot("SOLUSDT");assert.equal(calls,2);
});
test("futures metadata cache distinguishes margin currency and retries failed fetches",async()=>{
  let calls=0;
  const cache=new CoinDCXMarketService(async(_path,query)=>{calls++;if(calls===1)throw new Error("offline");return {instrument:{status:"active",quantity_increment:0.01,price_increment:0.05,min_quantity:0.01,min_trade_size:0.01,min_notional:5,position_currency_short_name:"SOL",quote_currency_short_name:query?.margin_currency_short_name}};},"unit-futures");
  await assert.rejects(()=>cache.futures("B-SOL_USDT","USDT"),/offline/);
  assert.equal((await cache.futures("B-SOL_USDT","USDT")).tickSize,0.05);
  await cache.futures("B-SOL_USDT","USDT");assert.equal(calls,2);
  await cache.futures("B-SOL_USDT","INR");assert.equal(calls,3);
});
test("undersized spot order is rejected before exchange placement",async()=>{
  const s=service();let calls=0;s.privatePost=async()=>{calls++;};
  await assert.rejects(()=>s.placeOrder({userId:2,tradingAccountId:1,order:{...order,quantity:0.04}}),{message:"coindcx_below_min_notional",statusCode:400});
  assert.equal(calls,0);
});
test("spot dispatch and persisted intent use the same normalized quantity and price",async()=>{
  const s=service();let prepared:any,body:any;
  s.privatePost=async(_c:any,_p:string,b:any)=>{body=b;assert.equal(prepared.quantity,Number(b.total_quantity));return {id:"entry"};};
  await s.placeOrder({userId:2,tradingAccountId:1,order},async(p:any)=>{prepared=p;});
  assert.equal(body.total_quantity,"1.234");assert.equal(body.price_per_unit,"100");
});
test("spot SELL uses available balance and does not subtract locked balance a second time",async()=>{
  const s=service();let body:any;
  s.privatePost=async(_c:any,path:string,b:any)=>path.endsWith("/balances")?[{currency:"SOL",balance:0.9989,locked_balance:0.1}]:(body=b,{id:"exit"});
  await s.placeOrder({userId:2,tradingAccountId:1,order:{...order,quantity:1,side:"SELL",orderType:"market_order",price:undefined}});
  assert.equal(body.total_quantity,"0.998");assert.equal(body.price_per_unit,undefined);
});
test("futures sets account leverage in the selected wallet before normalized entry",async()=>{
  const s=service();const calls:any[]=[];
  s.getFuturesAvailableBalances=async()=>({usdtAvailable:1000,inrAvailable:1000});
  s.resolveFuturesPricing=async()=>({entryPrice:100.023,usdtInrRate:85});
  s.privatePost=async(_c:any,path:string,body:any)=>{calls.push({path,body});return {id:"entry",status:200};};
  const response=await s.placeFuturesOrder({userId:2,tradingAccountId:1,order:{...order,symbol:"B-SOL_USDT",marginCurrency:"USDT"}});
  assert.ok(calls[0].path.endsWith("/positions/update_leverage"));assert.equal(calls[0].body.leverage,"3");assert.equal(calls[0].body.margin_currency_short_name,"USDT");
  assert.ok(calls[1].path.endsWith("/orders/create"));assert.equal(calls[1].body.order.total_quantity,1.234);assert.equal(calls[1].body.order.price,100);
  assert.equal(response.selectedWallet.marginCurrency,"USDT");
});
test("undersized futures child never changes leverage or creates an order",async()=>{
  const s=service();s.getFuturesAvailableBalances=async()=>({usdtAvailable:1000,inrAvailable:0});s.resolveFuturesPricing=async()=>({entryPrice:100,usdtInrRate:85});
  await assert.rejects(()=>s.placeFuturesOrder({userId:2,tradingAccountId:1,order:{...order,symbol:"B-SOL_USDT",quantity:0.04,leverage:2}}),/coindcx_below_min_notional/);
});
test("shared futures close cancels resting brackets before market exit",async()=>{
  const s=service();const paths:string[]=[];s.privatePost=async(_c:any,path:string)=>{paths.push(path);return {status:200};};
  await s.exitFuturesPosition({userId:2,tradingAccountId:1,positionId:"p1"});
  assert.ok(paths[0].endsWith("/cancel_all_open_orders_for_position"));assert.ok(paths[1].endsWith("/positions/exit"));
});
test("closed-position reconciliation cancels orphaned brackets and marks cleanup only on success",async t=>{
  const s=service();const writes:string[]=[];let cancellations=0;
  t.mock.method(AppDataSource,"query",async()=>[{id:1,broker_position_id:"p1"}]);
  t.mock.method(AppDataSource,"transaction",async(callback:any)=>callback({query:async(sql:string)=>{writes.push(sql);}}));
  s.getFuturesPositions=async()=>[{id:"p1",active_pos:0}];s.cancelFuturesOpenOrdersForPosition=async()=>{cancellations++;};
  await s.cleanupClosedProtection(account);assert.equal(cancellations,1);assert.ok(writes.some(sql=>sql.includes("status='closed'")));
  writes.length=0;s.cancelFuturesOpenOrdersForPosition=async()=>{throw new Error("offline");};
  await assert.rejects(()=>s.cleanupClosedProtection(account),/offline/);assert.equal(writes.length,0);
});
test("cleanup never interprets absent or active positions as closed",async t=>{
  const s=service();t.mock.method(AppDataSource,"query",async()=>[{id:1,broker_position_id:"p1"}]);
  s.cancelFuturesOpenOrdersForPosition=async()=>assert.fail("must not cancel");
  for(const positions of [[],[{id:"p1",active_pos:1}],[{id:"p1"}]]){s.getFuturesPositions=async()=>positions;await s.cleanupClosedProtection(account);}
});
test("runner rejects only undersized child and continues with a valid sibling",async t=>{
  const s=service();const writes:any[]=[];
  t.mock.method(TradeGuardService.prototype,"validateTrade",async()=>({allowed:true}));
  t.mock.method(AppDataSource,"query",async(sql:string,args:any[])=>{writes.push({sql,args});return [];});
  const job={symbol:"SOLUSDT",action:"BUY",volume:0.04,limitPrice:100,orderType:"limit_order",tradingAccount:account,status:{id:1,status:"in_progress"}};
  s.db.claimPendingTrades=async()=>[{...job,id:1},{...job,id:2,volume:1.2349}];s.db.markJobSuccess=async()=>{};
  s.privatePost=async()=>({id:"entry"});
  const batch=await s.executePendingBatch({batchSize:2});
  assert.equal(batch.failed,1);assert.equal(batch.completed,1);assert.equal(batch.items[0].error,"coindcx_below_min_notional");
  assert.ok(writes.some(q=>q.args[0]===1 && q.args[1]==="rejected"));
  assert.ok(writes.some(q=>q.sql.includes("volume=$2") && q.args[0]===2 && q.args[1]===1.234));
});
test("TradingView crypto CLOSE queues owned existing positions instead of opposite entries",async t=>{
  let scope:any;
  t.mock.method(CoinDCXService.prototype,"queueCloseAlert",async(input:any)=>{scope=input;return {snapshotId:null,signalCount:1,recipientCount:1};});
  const result=await new AlertSnapshotService().create({action:"CLOSE",symbol:"B-SOL_USDT",userId:2,subscriptionId:3,market:"CRYPTO"} as any);
  assert.equal(result.signalCount,1);assert.equal(scope.userId,2);assert.equal(scope.subscriptionId,3);
});

test("market futures prices use fresh real-time quotes, not active instrument names",async t=>{
  const s=service();let timestamp=Date.now();
  t.mock.method(axios,"get",async(url:string)=>{assert.equal(url,"https://public.coindcx.com/market_data/v3/current_prices/futures/rt");return {data:{ts:timestamp,prices:{"B-SOL_USDT":{ls:100.5}}}};});
  assert.equal(await s.getLatestFuturesPrice("B-SOL_USDT"),100.5);
  timestamp-=60000;await assert.rejects(()=>s.getLatestFuturesPrice("B-SOL_USDT"),{message:"latest_futures_price_not_available"});
});
test("broker-declined bracket cancellation prevents a false close dispatch",async()=>{
  const s=service();let requests=0;s.privatePost=async()=>{requests++;return {success:false,code:400};};
  await assert.rejects(()=>s.exitFuturesPosition({userId:2,tradingAccountId:1,positionId:"p1"}),{message:"coindcx_bracket_cancellation_failed"});
  assert.equal(requests,1);
});
