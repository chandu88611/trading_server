import test from "node:test";
import assert from "node:assert/strict";
import {aggregateFillMetrics} from "../../app/trade/services/fillMetrics.service";
import {SpotProtectionService,spotProtectionTrigger} from "../../app/trade/services/spotProtection.service";
import AppDataSource from "../../db/data-source";
import {CoinDCXService} from "../../app/coindcx/services/coindcx.service";
const fill=(id:number,side:string,price:number,qty=1,currency="INR",account=1)=>({id,account_id:account,fill_id:String(id),order_id:String(id),symbol:"ABC",side,fill_price:price,fill_qty:qty,fee:1,currency,executed_at:new Date(id*1000).toISOString()});
test("fill metrics keep currencies and accounts separate and include matched fees",()=>{
 const result=aggregateFillMetrics([fill(1,"BUY",100),fill(2,"SELL",110),fill(3,"BUY",200,1,"USDT",2),fill(4,"SELL",180,1,"USDT",2)]);
 assert.equal(result.totalTrades,4);assert.equal(result.closedTrades,2);assert.equal(result.winRate,50);
 assert.deepEqual(result.currencies.map(c=>[c.currency,c.realizedPnl]),[["INR",8],["USDT",-22]]);
});
test("fill metrics aggregate partial exits per order and deduplicate repeated fills",()=>{
 const open=fill(1,"BUY",100,2),a=fill(2,"SELL",110),b={...fill(3,"SELL",90),order_id:"2"};
 const result=aggregateFillMetrics([open,a,b,a]);assert.equal(result.totalTrades,2);assert.equal(result.closedTrades,1);assert.equal(result.winRate,0);assert.equal(result.currencies[0].realizedPnl,-3);
});
test("reported entry zero P&L does not count as a closed trade",()=>{
 const result=aggregateFillMetrics([{...fill(1,"BUY",100),realized_pnl:0},{...fill(2,"SELL",110),realized_pnl:10}]);
 assert.equal(result.closedTrades,1);assert.equal(result.currencies[0].realizedPnl,8);
 assert.equal(aggregateFillMetrics([]).winRate,null);
});
test("spot protection triggers at the exact SL/TP boundary and never shorts",()=>{
 const position={action:"BUY",stop_loss:95,take_profit:110};
 assert.equal(spotProtectionTrigger(position,95),"SL");assert.equal(spotProtectionTrigger(position,110),"TP");assert.equal(spotProtectionTrigger(position,100),null);assert.equal(spotProtectionTrigger(position,NaN),null);assert.equal(spotProtectionTrigger({...position,action:"SELL"},90),null);
});
test("spot watcher ignores stale quotes and queues only with fresh quotes",async t=>{
 const queries:string[]=[];
 t.mock.method(AppDataSource,"query",async(sql:string)=>{queries.push(sql);return sql.startsWith("SELECT")?[{id:1,symbol:"BTCINR",action:"BUY",stop_loss:95,take_profit:110}]:[[],0];});
 let timestamp=Date.now()-60000;
 t.mock.method(CoinDCXService.prototype,"getPublicTicker",async()=>[{market:"BTCINR",last_price:"111",get timestamp(){return timestamp;}}]);
 const watcher=new SpotProtectionService();await watcher.tick();assert.equal(queries.filter(q=>q.startsWith("UPDATE")).length,0);
 timestamp=Date.now();await watcher.tick();assert.equal(queries.filter(q=>q.startsWith("UPDATE")).length,1);
 assert.ok(queries.at(-1)!.includes("AND status='completed'"));
});
