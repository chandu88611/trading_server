import test from "node:test";
import assert from "node:assert/strict";
import AppDataSource from "../../db/data-source";
import { MasterFollowerLink } from "../../entity/MasterFollowerLink";
import { MamLinksService,validateMamSettings } from "../../app/trade/services/mamLinks.service";
import { EmergencyHaltService } from "../../app/trade/services/emergencyHalt.service";
import { publicActivity,ActivityFeedService } from "../../app/trade/services/activityFeed.service";
import { TradeGuardService } from "../../app/trade/services/tradeGuard.service";

test("emergency schema setup skips a missing account-status enum", async t => {
  const queries: string[] = [];
  t.mock.method(AppDataSource, "query", async (sql: string) => {
    queries.push(sql);
    return sql.includes("FROM pg_type") ? [] : [];
  });
  await new EmergencyHaltService().ensureSchema();
  assert.equal(queries.some(sql => sql.includes("ALTER TYPE user_trading_accounts_status_enum")), false);
});

test("emergency schema setup logs and continues when enum alteration fails", async t => {
  const warnings: unknown[] = [];
  const queries: string[] = [];
  t.mock.method(console, "warn", (...args: unknown[]) => warnings.push(args));
  t.mock.method(AppDataSource, "query", async (sql: string) => {
    queries.push(sql);
    if (sql.includes("FROM pg_type")) return [{ exists: 1 }];
    if (sql.includes("ALTER TYPE user_trading_accounts_status_enum")) throw new Error("status column is text");
    return [];
  });
  await new EmergencyHaltService().ensureSchema();
  assert.equal(queries.some(sql => sql.includes("ALTER TABLE trade_signals")), true);
  assert.equal(warnings.length, 1);
  assert.match(String(warnings[0]), /status column is text/);
});

test("MAM settings reject invalid rules and negative or missing sizing",()=>{
  for(const input of [{allocationType:"INVALID"},{allocationType:"MULTIPLIER",multiplier:0},{allocationType:"MULTIPLIER",maxAllocationLots:-1},{allocationType:"MULTIPLIER",isActive:"true"}])assert.throws(()=>validateMamSettings(input));
  assert.deepEqual(validateMamSettings({allocationType:"PROPORTIONAL_EQUITY",maxAllocationLots:0.25}),{allocationType:"PROPORTIONAL_EQUITY",maxAllocationLots:0.25});
  assert.deepEqual(validateMamSettings({isActive:false},true),{isActive:false});
});
function mamFixture(t:any) {
  const links:any[]=[];const accounts=[{id:1,userId:10,isMaster:true},{id:2,userId:10,accountLabel:"Follower",broker:{code:"COINDCX"},status:"verified"},{id:3,userId:20,isMaster:true}];
  const repo={create:(row:any)=>row,save:async(row:any)=>{if(!row.id)row.id=links.length+1;const index=links.findIndex(l=>l.id===row.id);if(index<0)links.push(row);else links[index]=row;return row;},findOne:async({where}:any)=>links.find(l=>Object.entries(where).every(([key,val])=>key==='deletedAt'?!l.deletedAt:l[key]===val))??null,find:async({where}:any)=>links.filter(l=>l.masterAccountId===where.masterAccountId&&!l.deletedAt).map(l=>({...l,followerAccount:accounts.find(a=>a.id===l.followerAccountId)}))};
  const manager:any={getRepository:(entity:any)=>entity===MasterFollowerLink?repo:{findOne:async({where}:any)=>accounts.find(a=>a.id===where.id&&a.userId===where.userId)??null},query:async(sql:string,args:any[]=[])=>sql.startsWith("SELECT a.id")?accounts.filter(a=>a.id===args[0]&&a.userId===args[1]):[]};
  t.mock.method(AppDataSource,"transaction",async(fn:any)=>fn(manager));
  t.mock.method(AppDataSource,"getRepository",(entity:any)=>manager.getRepository(entity));
  t.mock.method(AppDataSource.manager,"getRepository",(entity:any)=>manager.getRepository(entity));
  return {links,manager};
}
test("MAM CRUD persists sizing, pause state and unlink tombstones with scoped ownership",async t=>{
  const {links}=mamFixture(t);const service=new MamLinksService();
  const created=await service.create(10,{masterAccountId:1,followerAccountId:2,allocationType:"MULTIPLIER",multiplier:0.5,maxAllocationLots:0.2});
  assert.equal(created.id,1);assert.equal((await service.list(10,1))[0].multiplier,0.5);
  await assert.rejects(()=>service.create(10,{masterAccountId:1,followerAccountId:2,allocationType:"MULTIPLIER"}),{statusCode:409});
  await service.update(10,1,{isActive:false,multiplier:0.25});assert.equal(links[0].isActive,false);assert.equal(links[0].multiplier,0.25);
  await assert.rejects(()=>service.update(20,1,{isActive:true}),{statusCode:404});
  await service.update(10,1,{},true);assert.equal((await service.list(10,1)).length,0);assert.ok(links[0].deletedAt);assert.equal(links[0].isActive,false);
  const restored=await service.create(10,{masterAccountId:1,followerAccountId:2,allocationType:"PROPORTIONAL_EQUITY"});assert.equal(restored.id,1);assert.equal(restored.deletedAt,null);
});
test("MAM refuses self links, cross-user grants without consent and link cycles",async t=>{
  const {manager}=mamFixture(t);const service=new MamLinksService();
  await assert.rejects(()=>service.create(10,{masterAccountId:1,followerAccountId:1,allocationType:"MULTIPLIER"}),{statusCode:400});
  await assert.rejects(()=>service.create(10,{masterAccountId:1,followerAccountId:3,allocationType:"MULTIPLIER"}),{statusCode:404});
  const query=manager.query;manager.query=async(sql:string,args:any[])=>sql.startsWith("WITH RECURSIVE")?[{id:1}]:query(sql,args);
  await assert.rejects(()=>service.create(10,{masterAccountId:1,followerAccountId:2,allocationType:"MULTIPLIER"}),{message:"mam_link_would_create_cycle"});
});
function haltFixture(t:any) {
  const state:any={account:{id:1,user_id:10,status:"halted",account_meta:{emergencyHalt:true,preHaltStatus:"verified",riskHalt:{reason:"daily_loss_limit"}}},halt:"confirmed",writes:[] as string[]};
  const manager={query:async(sql:string,args:any[]=[])=>{
    if(sql.startsWith("SELECT * FROM user_trading_accounts"))return args[1]===10?[state.account]:[];
    if(sql.startsWith("SELECT state"))return [{state:state.halt}];
    if(sql.startsWith("UPDATE")){state.writes.push(sql);if(sql.includes("state='resumed'"))state.halt='resumed';if(sql.includes("status='verified'")){state.account.status='verified';delete state.account.account_meta.emergencyHalt;}}
    return [];
  }};
  t.mock.method(AppDataSource,"transaction",async(fn:any)=>fn(manager));return state;
}
test("resume restores verified intake, is idempotent and leaves daily risk limits intact",async t=>{
  const state=haltFixture(t);const service=new EmergencyHaltService();
  assert.equal((await service.resume(10,1)).status,"verified");assert.equal(state.halt,"resumed");assert.equal(state.account.account_meta.riskHalt.reason,"daily_loss_limit");assert.ok(state.writes.some((sql:string)=>sql.includes("is_enabled=true")));
  const count=state.writes.length;await service.resume(10,1);assert.equal(state.writes.length,count);
});
test("resume rejects foreign accounts, unfinished cleanup and unverified accounts",async t=>{
  const state=haltFixture(t);const service=new EmergencyHaltService();
  await assert.rejects(()=>service.resume(20,1),{statusCode:404});
  state.halt="pending";await assert.rejects(()=>service.resume(10,1),{message:"halt_cleanup_pending"});
  state.halt="confirmed";state.account.account_meta.preHaltStatus="pending";await assert.rejects(()=>service.resume(10,1),{message:"account_verification_required"});assert.equal(state.writes.length,0);
});
test("halt worker skips a stale task after resume without contacting a broker",async t=>{
  t.mock.method(AppDataSource,"query",async()=>[{account_id:1}]);
  t.mock.method(AppDataSource,"createQueryRunner",()=>({connect:async()=>{},release:async()=>{},query:async(sql:string)=>sql.includes("pg_try")?[{acquired:true}]:sql.startsWith("SELECT state")?[{state:"resumed"}]:[]}) as any);
  t.mock.method(AppDataSource,"getRepository",()=>{assert.fail("resumed task must not reach broker lookup");});
  await new EmergencyHaltService().processPending();
});
test("halt flag still blocks entries if broker verification updates the status",async t=>{
  t.mock.method(AppDataSource,"transaction",async(fn:any)=>fn({query:async()=>[{status:"verified",is_enabled:true,account_meta:{emergencyHalt:true}}]}));
  t.mock.method(AppDataSource,"query",async()=>[]);
  const result=await new TradeGuardService().validateTrade({id:1},{id:1,action:"BUY"});assert.equal(result.allowed,false);
  assert.equal((await new TradeGuardService().validateTrade({id:1},{id:1,action:"CLOSE"})).allowed,true);
});
test("activity maps guard and broker errors to safe messages without leaking stacks or tokens",()=>{
  const row={id:1,account_id:2,signal_id:3,symbol:"BTCINR",created_at:new Date()};
  assert.equal(publicActivity({...row,status:"REJECTED_RISK_LIMIT",reason:"daily_loss_limit"}).kind,"GUARD_BLOCKED");
  const reject=publicActivity({...row,status:"failed",reason:"Error: token expired apiSecret=private\nstack"});assert.equal(reject.kind,"REJECTED");assert.ok(!JSON.stringify(reject).includes("private"));
  assert.equal(publicActivity({...row,status:"closed"}).message,"Closed");
});
test("activity feed scopes to authenticated user and caps results at twenty",async t=>{
  t.mock.method(AppDataSource,"query",async(sql:string,args:any[])=>{assert.ok(sql.includes("user_id=$1"));assert.ok(sql.includes("LIMIT 20"));assert.deepEqual(args,[10,1]);return [];});
  assert.deepEqual(await new ActivityFeedService().list(10,1),[]);
});
