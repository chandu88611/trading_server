import assert from "node:assert/strict";
import {EventEmitter} from "node:events";
import test from "node:test";
import {bindCoinDCXStream} from "../../app/coindcx/services/coindcx.stream";

class FakeSocket extends EventEmitter {
  connected = false;
  active: boolean | undefined = false;
  connectCalls = 0;
  connect() { this.connectCalls++; return this; }
  disconnect() { this.connected = false; this.emit("disconnect", "io client disconnect"); return this; }
}
function fixture(t: any) {
  const timers: {callback:()=>void;delay:number;cleared:boolean}[] = [];
  t.mock.method(Math,"random",()=>1);
  t.mock.method(global,"setTimeout",(callback:()=>void,delay:number)=>{
    const timer={callback,delay,cleared:false,unref:()=>{}};timers.push(timer);return timer;
  });
  t.mock.method(global,"clearTimeout",(timer:any)=>{timer.cleared=true;});
  const socket=new FakeSocket();
  const events:string[]=[];const joins:unknown[]=[];let failures=0;
  socket.on("join",auth=>joins.push(auth));
  const close=bindCoinDCXStream(socket as any,{apiKey:"test-key",authSignature:"test-signature"},kind=>events.push(kind),()=>failures++);
  t.after(close);
  return {socket,timers,joins,events,close,failures:()=>failures};
}
test("CoinDCX rejoins its private channel after every reconnect without duplicating event handlers",t=>{
  const f=fixture(t);
  f.socket.connected=true;f.socket.emit("connect");
  f.socket.connected=false;f.socket.emit("disconnect","io server disconnect");
  assert.equal(f.timers[0].delay,1000);
  f.timers[0].callback();assert.equal(f.socket.connectCalls,1);
  f.socket.connected=true;f.socket.emit("connect");
  assert.deepEqual(f.joins,[{channelName:"coindcx",apiKey:"test-key",authSignature:"test-signature"},{channelName:"coindcx",apiKey:"test-key",authSignature:"test-signature"}]);
  f.socket.emit("df-order-update");assert.equal(f.events.filter(x=>x==="df-order-update").length,1);
});
test("CoinDCX namespace failures retry exponentially, cap at 30s, and reset after connection",t=>{
  const f=fixture(t);
  for(let i=0;i<7;i++){
    f.socket.emit("connect_error",new Error("offline"));
    f.socket.emit("error","offline");
    assert.equal(f.timers.length,i+1,"only one pending retry");
    assert.equal(f.timers[i].delay,Math.min(30000,1000*2**i));
    f.timers[i].callback();
  }
  f.socket.connected=true;f.socket.emit("connect");
  f.socket.connected=false;f.socket.emit("disconnect","io server disconnect");
  assert.equal(f.timers.at(-1)!.delay,1000);
});
test("CoinDCX uses native transport retries and also recovers Socket.IO v2 namespace errors",t=>{
  const f=fixture(t);f.socket.active=true;
  f.socket.emit("connect_error",new Error("transport failed"));
  assert.equal(f.timers.length,0,"native Manager owns active transport reconnection");
  f.socket.active=undefined;f.socket.emit("error","namespace rejected");
  assert.equal(f.timers.length,1);
  f.timers[0].callback();assert.equal(f.socket.connectCalls,1);
});
test("CoinDCX intentional shutdown cancels retries and removes subscriptions",t=>{
  const f=fixture(t);f.socket.emit("connect_error",new Error("offline"));
  f.close();assert.equal(f.timers[0].cleared,true);
  f.timers[0].callback();assert.equal(f.socket.connectCalls,0);
  f.socket.emit("connect");f.socket.emit("order-update");
  assert.equal(f.joins.length,0);assert.equal(f.events.length,0);
  assert.equal(f.socket.listenerCount("disconnect"),0);
});
