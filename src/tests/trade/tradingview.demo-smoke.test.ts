import { MamLinksService } from "../../app/trade/services/mamLinks.service";
import { ActivityFeedService } from "../../app/trade/services/activityFeed.service";
import { allocateFollowers } from "../../app/trade/services/mamAllocation.service";
import { TradingAccountDBService } from "../../app/tradingAccount/services/tradingAccount.db";
import {SpotProtectionService} from "../../app/trade/services/spotProtection.service";
import {TradingAccountController} from "../../app/tradingAccount/controllers/tradingAccount.controller";
import {TradingAccountRouter} from "../../app/tradingAccount/routes/tradingAccount.route";
import {UserController} from "../../app/user/controllers/user.controller";
import {requireAuth,Roles} from "../../middleware/auth";
import {AdminStrategyTradeScheduleSetting} from "../../entity/AdminStrategyTradeScheduleSetting";
import { encryptCredentials } from "../../utils/crypto";
import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import express from "express";
import axios from "axios";
import AppDataSource from "../../db/data-source";
import { EmergencyHaltService } from "../../app/trade/services/emergencyHalt.service";
import { ReconciliationService } from "../../app/trade/services/reconciliation.service";
import { TradeSignal } from "../../entity/TradeSignals";
import { CoinDCXService } from "../../app/coindcx/services/coindcx.service";
import { signWebhookToken, signAccessToken } from "../../middleware/auth";

// Opt-in only: the launcher must supply a dedicated disposable localhost database.
test("TradingView -> PostgreSQL pending -> guard -> mock CoinDCX -> dashboard history", {
  skip: !process.env.DEMO_SMOKE_DB_PORT,
}, async () => {
  const port = Number(process.env.DEMO_SMOKE_DB_PORT);
  assert.ok(Number.isInteger(port) && port > 1024);
  AppDataSource.setOptions({ host: "127.0.0.1", port, username: "postgres",
    password: "demo-smoke-only", database: "tradebro_demo_smoke", synchronize: false });
  process.env.ENCRYPTION_KEY = "ab".repeat(32);
  process.env.JWT_SECRET = "tradebro-demo-smoke-isolated-fixture-secret";
  const originalAdapter = axios.defaults.adapter;
  let server: ReturnType<ReturnType<typeof express>["listen"]> | undefined;
  const fills: any[] = [];
  const protection: any[] = [];
  const cancellations: any[] = [];
  let futuresActive = 0.101;
  const dispatched: { path: string; body: any }[] = [];
  try {
    await AppDataSource.initialize();
    // Existing migrations create each index once; duplicate entity decorators
    // must not prevent constructing an equivalent disposable test schema.
    for (const metadata of AppDataSource.entityMetadatas) {
      metadata.indices = metadata.indices.filter((index, i, indices) => indices.findIndex(other => other.name === index.name) === i);
    }
    assert.ok(AppDataSource.hasMetadata(AdminStrategyTradeScheduleSetting));
    await AppDataSource.synchronize();
    await AppDataSource.getRepository(AdminStrategyTradeScheduleSetting).save({id:1,isEnabled:false,timezone:"Asia/Kolkata",windows:[]});
    await AppDataSource.getRepository(AdminStrategyTradeScheduleSetting).findOneByOrFail({id:1});
    await new EmergencyHaltService().ensureSchema();
    await new ReconciliationService().ensureSchema();
    await new MamLinksService().ensureSchema();
    await new ActivityFeedService().ensureSchema();
    await AppDataSource.query(`CREATE TABLE IF NOT EXISTS admin_risk_rules (id int PRIMARY KEY, data jsonb NOT NULL)`);
    const [user] = await AppDataSource.query(`INSERT INTO users (email,password_hash,allow_trade) VALUES ('demo@example.invalid','fixture',true) RETURNING id`);
    const [market] = await AppDataSource.query(`INSERT INTO markets (code,name) VALUES ('CRYPTO','Crypto') RETURNING id`);
    const [type] = await AppDataSource.query(`INSERT INTO plan_types (code,name) VALUES ('SELF_TRADE','Demo') RETURNING id`);
    const [plan] = await AppDataSource.query(`INSERT INTO subscription_plans (plan_type_id,market_id,name) VALUES ($1,$2,'Demo') RETURNING id`, [type.id, market.id]);
    const [sub] = await AppDataSource.query(`INSERT INTO user_subscriptions (user_id,plan_id,status,status_v2,is_webhook_enabled,end_date) VALUES ($1,$2,'active','active',true,NOW()+interval '1 day') RETURNING id`, [user.id, plan.id]);
    const [broker] = await AppDataSource.query(`INSERT INTO brokers (code,name,market_category) VALUES ('COINDCX','CoinDCX','CRYPTO') RETURNING id`);
    const [account] = await AppDataSource.query(`INSERT INTO user_trading_accounts (user_id,subscription_id,broker_id,account_id,is_master,status,credentials_encrypted,access_token,refresh_token,account_meta) VALUES ($1,$2,$3,'demo',true,'verified','','','',$4) RETURNING id`, [user.id, sub.id, broker.id, JSON.stringify(encryptCredentials({ coindcx: { apiKey: "demo-key", apiSecret: "demo-secret", baseUrl: "https://broker.example.invalid" } }))]);
    await AppDataSource.query(`INSERT INTO user_risk_limits (user_id,is_enabled,daily_loss_limit,daily_profit_target,configuration) VALUES ($1,true,100,1000,$2)`, [user.id, JSON.stringify({ maxConsecutiveLosses: 3, maxLotPerTrade: 1 })]);

    const app = express();
    app.use(express.json());
    const accountController=new TradingAccountController();
    app.get("/api/v1/trading-account",requireAuth([Roles.USER]),accountController.listMyAccountsMe.bind(accountController));
    app.use("/trading-accounts",new TradingAccountRouter().getRouter());
    const userController=new UserController();
    app.patch("/user/trading-preferences",requireAuth([Roles.USER]),userController.saveTradingPreferences.bind(userController));
    app.use("/tradingview/alerts", require("../../app/broker/brokerAlerts/routes/alertSnapshot.route").default);
    const { TradeRouter } = require("../../app/trade/routes/trade.route");
    app.use("/trade", new TradeRouter().getRouter());
    app.use(new TradeRouter().getFeedbackRouter());
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server!.once("listening", resolve));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const origin = `http://127.0.0.1:${address.port}`;
    axios.defaults.adapter = async config => {
      const url = String(config.url);
      if(url==="https://api.coindcx.com/exchange/v1/markets_details") return {config,status:200,statusText:"OK",headers:{},data:[{coindcx_name:"BTCINR",status:"active",step:0.001,min_quantity:0.001,min_notional:5,base_currency_precision:2,target_currency_short_name:"BTC",base_currency_short_name:"INR"}]};
      if(url==="https://api.coindcx.com/exchange/v1/derivatives/futures/data/instrument") return {config,status:200,statusText:"OK",headers:{},data:{instrument:{status:"active",quantity_increment:0.001,price_increment:0.05,min_quantity:0.001,min_trade_size:0.001,min_notional:5,position_currency_short_name:"BTC",quote_currency_short_name:"USDT"}}};
      if(url==="https://api.coindcx.com/exchange/ticker") return {config,status:200,statusText:"OK",headers:{},data:[{market:"BTCINR",last_price:"115",timestamp:Date.now()}]};
      assert.ok(url.startsWith("https://broker.example.invalid/"), `Unexpected external request: ${url}`);
      const path = new URL(url).pathname;
      if (path.endsWith("/wallets") || path.endsWith("/users/balances")) {
        return { config, status: 200, statusText: "OK", headers: {}, data: [{ currency_short_name: "USDT", currency: "USDT", balance: 100000, available_balance: 100000 },{currency:"BTC",balance:0.100798,locked_balance:0}] };
      }
      const body = JSON.parse(config.data || "{}");
      assert.equal(config.headers["X-AUTH-SIGNATURE"], crypto.createHmac("sha256", "demo-secret").update(config.data).digest("hex"));
      let data: any;
      if (path.endsWith("/orders/create")) {
        dispatched.push({ path, body });
        const order = body.order ?? body;
        const id = `demo-order-${dispatched.length}`;
        fills.push({ id: `fill-${dispatched.length}`, order_id:id, ...(order.pair ? {pair:order.pair} : {symbol:order.market}), side:order.side, price:Number(order.price_per_unit ?? 100), quantity:Number(order.total_quantity), timestamp:Date.now(), fee:0 });
        data = [{id,status:"filled"}];
      } else if (path.endsWith("/orders/trade_history")) data = fills.filter(f => !f.pair);
      else if (path.endsWith("/futures/trades")) data = fills.filter(f => f.pair === body.pair && f.order_id === body.order_id);
      else if (path.endsWith("/orders/active_orders")) data = [];
      else if (path.endsWith("/futures/positions")) data = [{id:"position-1",pair:"B-BTC_USDT",active_pos:futuresActive}];
      else if (path.endsWith("/positions/update_leverage")) {assert.equal(body.leverage,"2");data={status:200,message:"success"};}
      else if (path.endsWith("/positions/cancel_all_open_orders_for_position")) {cancellations.push(body);data={status:200};}
      else if (path.endsWith("/positions/exit")) {
        assert.ok(cancellations.length>0,"brackets must be cancelled before exit");
        futuresActive=0;
        fills.push({id:"fill-futures-close",order_id:"futures-close",pair:"B-BTC_USDT",side:"sell",price:110,quantity:0.101,timestamp:Date.now(),fee:0});
        data={id:"futures-close",status:200};
      }
      else if (path.endsWith("/positions/create_tpsl")) { protection.push(body); data = {stop_loss:{id:"sl-1"},take_profit:{id:"tp-1"}}; }
      else assert.fail(`Unexpected broker route: ${path}`);
      return {config,status:200,statusText:"OK",headers:{},data};
    };
    const token = signWebhookToken({ userId: user.id, subscriptionId: sub.id, planId: plan.id }, new Date(Date.now() + 3600000));
    const accessToken = signAccessToken({ userId: user.id, roles: ["USER"] });
    const headers = { "content-type": "application/json", authorization: `Bearer ${token}` };
    const dashboardHeaders = { "content-type": "application/json", authorization: `Bearer ${accessToken}` };
    const runner = new CoinDCXService();
    for (const symbol of ["BTCINR", "B-BTC_USDT"]) {
      const response = await fetch(`${origin}/tradingview/alerts`, { method: "POST", headers,
        body: JSON.stringify({ action: "BUY", symbol, volume: 0.1019, sl: 95, tp: 110, limitPrice: 100 }) });
      const accepted: any = await response.json();
      assert.equal(response.status, 200, JSON.stringify(accepted));
      assert.equal(accepted.data.signalCount, 1);
      const job = await AppDataSource.getRepository(TradeSignal).findOneOrFail({ where: { symbol }, relations: { status: true } });
      assert.equal(job.status.status, "pending");
      assert.equal(Number(job.stopLoss), 95);
      assert.equal(Number(job.takeProfit), 110);
      assert.equal(Number(job.limitPrice), 100);
      assert.equal(Number(job.volume), 0.1019);
      const batch = await runner.executePendingBatch({ batchSize: 1 });
      assert.equal(batch.failed, 0, JSON.stringify(batch));
      assert.equal(batch.completed, 1);
      const submitted = await AppDataSource.getRepository(TradeSignal).findOneOrFail({where:{id:job.id},relations:{status:true}});
      assert.equal(submitted.status.status,"submitted");
      assert.equal(Number(submitted.volume),0.101,"persisted volume must match quantized order");
      const brokerAccount = submitted.tradingAccount ?? await AppDataSource.getRepository(require("../../entity/UserTradingAccount").UserTradingAccount).findOneOrFail({where:{id:account.id},relations:{broker:true}});
      await new ReconciliationService().reconcileAccount(brokerAccount as any);
      const executed = await AppDataSource.getRepository(TradeSignal).findOneOrFail({ where: { id: job.id }, relations: { status: true } });
      assert.equal(executed.status.status, "completed");
      assert.ok(executed.brokerOrderId);
      assert.ok(executed.riskReservedAt);
      if (symbol === "BTCINR") {
        await Promise.all([new SpotProtectionService().tick(),new SpotProtectionService().tick()]);
        const pendingClose=await AppDataSource.getRepository(TradeSignal).findOneOrFail({where:{id:job.id},relations:{status:true}});
        assert.equal(pendingClose.status.status,"pending_close");
        const closed = await runner.executePendingBatch({ batchSize: 1 });
        assert.equal(closed.failed, 0, JSON.stringify(closed));
        await new ReconciliationService().reconcileAccount(brokerAccount as any);
        const history = await fetch(`${origin}/trade/history?accountId=${account.id}`, { headers: dashboardHeaders });
        assert.equal(history.status, 200);
        const rows: any = await history.json();
        assert.ok(rows.some((row: any) => row.id === job.id && row.status.status === "closed"));
      } else {
        const outgoing = dispatched.at(-1)!;
        assert.ok(outgoing.path.includes("/derivatives/futures/"));
        assert.equal(outgoing.body.order.stop_loss_price, undefined);
        assert.equal(protection.length,1);
        assert.equal(Number(protection[0].stop_loss.stop_price),95);
        assert.equal(Number(protection[0].take_profit.stop_price),110);
        assert.equal(executed.protectionState,"ACTIVE");
        await new ReconciliationService().reconcileAccount(brokerAccount as any);
        assert.equal(protection.length,1,"native protection must not be duplicated");
        assert.equal(outgoing.body.order.take_profit_price, undefined);
        assert.equal(Number(outgoing.body.order.total_quantity), 0.101);
        const active = await fetch(`${origin}/trade/all?accountId=${account.id}`, { headers: dashboardHeaders });
        assert.equal(active.status, 200);
        const rows: any = await active.json();
        assert.ok(rows.some((row: any) => row.id === job.id && row.status.status === "completed"));
      }
    }
    assert.equal(Number((await AppDataSource.query("SELECT count(*) AS n FROM trade_fill_history"))[0].n),3);
    const accountsResponse=await fetch(`${origin}/api/v1/trading-account`,{headers:dashboardHeaders});
    assert.equal(accountsResponse.status,200);
    const accountsBody:any=await accountsResponse.json();assert.equal(accountsBody.data[0].isMaster,true);
    assert.ok(!JSON.stringify(accountsBody).includes("enc:v1:"));
    const metricsResponse=await fetch(`${origin}/trade/metrics`,{headers:dashboardHeaders});
    assert.equal(metricsResponse.status,200);const metrics:any=await metricsResponse.json();assert.equal(metrics.data.totalTrades,3);assert.equal(metrics.data.closedTrades,1);
    const prefs=await fetch(`${origin}/user/trading-preferences`,{method:"PATCH",headers:dashboardHeaders,body:JSON.stringify({allowTrade:true,executionMode:"SIGNALS_ONLY",allowedMarkets:{FOREX:true,INDIA:true,CRYPTO:true,COPY:true}})});
    assert.equal(prefs.status,200,await prefs.text());
    const [risk]=await AppDataSource.query(`SELECT configuration,daily_loss_limit FROM user_risk_limits WHERE user_id=$1`,[user.id]);assert.equal(risk.configuration.maxConsecutiveLosses,3);assert.equal(risk.configuration.executionMode,"SIGNALS_ONLY");assert.equal(Number(risk.daily_loss_limit),100);
    const [follower]=await AppDataSource.query(`INSERT INTO user_trading_accounts(user_id,broker_id,account_id,is_master,status,credentials_encrypted,access_token,refresh_token) VALUES($1,$2,'follower',false,'verified','','','') RETURNING id`,[user.id,broker.id]);
    await AppDataSource.query(`INSERT INTO copy_trading_masters(master_trading_account_id,user_trading_account_id,is_active) VALUES($1,$2,true)`,[account.id,follower.id]);
    const allocation=await fetch(`${origin}/trading-accounts/${account.id}/followers/${follower.id}/allocation`,{method:"PATCH",headers:dashboardHeaders,body:JSON.stringify({mode:"MULTIPLIER",multiplier:0.5})});
    assert.equal(allocation.status,200,await allocation.text());
    const linked=await fetch(`${origin}/trading-accounts/${account.id}/followers`,{headers:dashboardHeaders});assert.equal(linked.status,200);const linkedBody:any=await linked.json();assert.equal(linkedBody.data[0].allocation.multiplier,0.5);
    const forbidden=await fetch(`${origin}/trading-accounts/${account.id}/followers`,{headers:{authorization:`Bearer ${signAccessToken({userId:9999,roles:["USER"]})}`}});assert.equal(forbidden.status,404);
    assert.equal(dispatched.length, 3);
    assert.equal(dispatched[1].body.side, "sell");
    assert.equal(Number(dispatched[1].body.total_quantity),0.100,"spot exit must floor to post-fee available balance");
    const closeResponse = await fetch(`${origin}/tradingview/alerts`,{method:"POST",headers,body:JSON.stringify({action:"CLOSE",symbol:"B-BTC_USDT",market:"CRYPTO"})});
    const closeBody:any=await closeResponse.json();assert.equal(closeResponse.status,200,JSON.stringify(closeBody));assert.equal(closeBody.data.signalCount,1);
    const exitBatch=await runner.executePendingBatch({batchSize:10});assert.equal(exitBatch.failed,0,JSON.stringify(exitBatch));assert.equal(exitBatch.completed,1);
    const brokerAccount=await AppDataSource.getRepository(require("../../entity/UserTradingAccount").UserTradingAccount).findOneOrFail({where:{id:account.id},relations:{broker:true}});
    await new ReconciliationService().reconcileAccount(brokerAccount as any);
    const closedFuture=await AppDataSource.getRepository(TradeSignal).findOneOrFail({where:{symbol:"B-BTC_USDT"},relations:{status:true}});
    assert.equal(closedFuture.status.status,"closed");assert.equal(closedFuture.protectionState,"CLEANED");assert.equal(closedFuture.brokerCloseOrderId,"futures-close");
    assert.equal(cancellations.length,2,"exit and flat-position reconciliation both clean brackets");
    await new ReconciliationService().reconcileAccount(brokerAccount as any);assert.equal(cancellations.length,2,"confirmed cleanup is idempotent");
    // Dedicated MAM entity backfills current links and keeps legacy dispatch in sync.
    await new MamLinksService().ensureSchema();
    const mamUrl=`${origin}/api/v1/trading/mam/links`;
    const list=await fetch(`${mamUrl}/${account.id}`,{headers:dashboardHeaders});assert.equal(list.status,200);
    const linkRows:any=await list.json();assert.equal(linkRows.data.length,1);assert.equal(linkRows.data[0].multiplier,0.5);
    const linkId=linkRows.data[0].id;
    const change=await fetch(`${mamUrl}/${linkId}`,{method:"PATCH",headers:dashboardHeaders,body:JSON.stringify({multiplier:0.25,maxAllocationLots:0.2})});assert.equal(change.status,200,await change.text());
    const fanout=async()=>{const qr=AppDataSource.createQueryRunner();await qr.connect();try{return await allocateFollowers([{tradingAccountId:Number(account.id),userId:Number(user.id),volume:1,symbol:"BTCINR",action:"BUY",alertSnapshotsId:1}] as any,qr);}finally{await qr.release();}};
    const children=await fanout();assert.equal(children.length,2);assert.equal(Number(children[1].tradingAccountId),Number(follower.id));assert.equal(children[1].volume,0.2);
    const pause=await fetch(`${mamUrl}/${linkId}`,{method:"PATCH",headers:dashboardHeaders,body:JSON.stringify({isActive:false})});assert.equal(pause.status,200);assert.equal((await fanout()).length,1);
    assert.equal((await new TradingAccountDBService().getAllCopyTradingAccounts([Number(account.id)])).length,0,"paused link must also suppress the legacy dispatch target");
    const unlink=await fetch(`${mamUrl}/${linkId}`,{method:"DELETE",headers:dashboardHeaders});assert.equal(unlink.status,204);
    await new MamLinksService().ensureSchema();assert.equal((await new MamLinksService().list(Number(user.id),Number(account.id))).length,0,"backfill cannot resurrect an unlinked follower");
    const create=await fetch(mamUrl,{method:"POST",headers:dashboardHeaders,body:JSON.stringify({masterAccountId:Number(account.id),followerAccountId:Number(follower.id),allocationType:"MULTIPLIER",multiplier:0.5})});assert.equal(create.status,201,await create.text());
    const unauthorizedHeaders={...dashboardHeaders,authorization:`Bearer ${signAccessToken({userId:9999,roles:["USER"]})}`};
    assert.equal((await fetch(`${mamUrl}/${account.id}`,{headers:unauthorizedHeaders})).status,404);
    // Resume waits for confirmed cleanup, then makes new intake eligible without clearing risk preferences.
    const halted=await fetch(`${origin}/api/v1/trading/emergency-halt`,{method:"POST",headers:dashboardHeaders,body:JSON.stringify({accountId:Number(account.id)})});assert.equal(halted.status,202,await halted.text());
    const resumeUrl=`${origin}/api/v1/trading/resume-trading`;
    assert.equal((await fetch(resumeUrl,{method:"POST",headers:dashboardHeaders,body:JSON.stringify({accountId:Number(account.id)})})).status,409);
    await new EmergencyHaltService().processPending();
    const resumed=await fetch(resumeUrl,{method:"POST",headers:dashboardHeaders,body:JSON.stringify({accountId:Number(account.id)})});assert.equal(resumed.status,200,await resumed.text());
    const [afterResume]=await AppDataSource.query(`SELECT status,is_enabled,account_meta FROM user_trading_accounts WHERE id=$1`,[account.id]);assert.equal(afterResume.status,"verified");assert.equal(afterResume.is_enabled,true);assert.equal(afterResume.account_meta.emergencyHalt,undefined);
    assert.equal((await fetch(resumeUrl,{method:"POST",headers:unauthorizedHeaders,body:JSON.stringify({accountId:Number(account.id)})})).status,404);
    // Durable guard/rejection history is user-scoped and unchanged status polling does not add events.
    await AppDataSource.query(`UPDATE trade_signals_status SET status='REJECTED_RISK_LIMIT',last_error='daily_loss_limit' WHERE signal_id=$1`,[closedFuture.id]);
    await AppDataSource.query(`UPDATE trade_signals_status SET status='rejected',last_error='coindcx_below_min_notional' WHERE signal_id=$1`,[closedFuture.id]);
    const before=Number((await AppDataSource.query(`SELECT count(*) n FROM trade_activity_events`))[0].n);
    await AppDataSource.query(`UPDATE trade_signals_status SET status='rejected',last_error='coindcx_below_min_notional',updated_at=now() WHERE signal_id=$1`,[closedFuture.id]);
    assert.equal(Number((await AppDataSource.query(`SELECT count(*) n FROM trade_activity_events`))[0].n),before);
    const activity=await fetch(`${origin}/api/v1/trade/activity-feed`,{headers:dashboardHeaders});assert.equal(activity.status,200);const activityBody:any=await activity.json();
    for(const kind of ['STATUS_CHANGED','GUARD_BLOCKED','REJECTED'])assert.ok(activityBody.data.some((e:any)=>e.kind===kind));assert.ok(activityBody.data.length<=20);
    const foreignActivity:any=await (await fetch(`${origin}/api/v1/trade/activity-feed`,{headers:unauthorizedHeaders})).json();assert.deepEqual(foreignActivity.data,[]);


  } finally {
    axios.defaults.adapter = originalAdapter;
    if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
  }
});
