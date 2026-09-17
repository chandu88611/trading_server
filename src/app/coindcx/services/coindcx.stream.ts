import { QueryRunner } from "typeorm";
import crypto from "crypto";
import { io, Socket } from "socket.io-client";
import AppDataSource from "../../../db/data-source";
import { CoinDCXService } from "./coindcx.service";
import { ReconciliationService } from "../../trade/services/reconciliation.service";
import { publishTradeEvent } from "../../trade/services/tradeEvents.service";
const legacyIo: typeof io = require("coindcx-socket-legacy");

/** Socket.IO retries transport failures; namespace/server disconnects need an explicit reconnect. */
export function bindCoinDCXStream(
  socket: Socket,
  auth: { authSignature: string; apiKey: string },
  changed: (kind: string) => void,
  unavailable: () => void,
) {
  let stopped = false;
  let attempts = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (stopped || retry || socket.connected) return;
    // Native transport reconnection uses the Manager's exponential backoff.
    if (socket.active === true) return;
    const delay = Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5)) * (0.75 + Math.random() * 0.25);
    retry = setTimeout(() => {
      retry = undefined;
      if (!stopped && !socket.connected) socket.connect();
    }, delay);
    retry.unref();
  };
  const connected = () => {
    if (stopped) return;
    if (retry) clearTimeout(retry);
    retry = undefined;
    attempts = 0;
    socket.emit("join", {channelName:"coindcx", ...auth});
    changed("reconnected");
  };
  const failed = () => { if (!stopped) { unavailable(); schedule(); } };
  socket.on("connect", connected);
  socket.on("disconnect", failed);
  socket.on("connect_error", failed);
  socket.on("error", failed); // Socket.IO v2 namespace errors.
  const handlers = ["order-update","trade-update","balance-update","df-order-update","df-position-update"].map(event => {
    const handler = () => { if (!stopped) changed(event); };
    socket.on(event, handler);
    return {event,handler};
  });
  return () => {
    stopped = true;
    if (retry) clearTimeout(retry);
    socket.off("connect", connected);
    socket.off("disconnect", failed);
    socket.off("connect_error", failed);
    socket.off("error", failed);
    handlers.forEach(({event,handler}) => socket.off(event,handler));
    socket.disconnect();
  };
}

/** One pair of authenticated streams per account, with reconnect and credential rotation. */
export class CoinDCXStreams {
  private lockRunner?: QueryRunner;
  private sessions = new Map<number, { fingerprint: string; close: () => Promise<void> }>();
  async refresh() {
    if (!this.lockRunner) {
      const runner = AppDataSource.createQueryRunner();
      const connection = await runner.connect();
      this.lockRunner = runner;
      connection.once("error", () => {
        this.lockRunner = undefined;
        for (const session of this.sessions.values()) void session.close();
        this.sessions.clear();
        void runner.release().catch(() => {});
      });
    }
    const accounts = await AppDataSource.query(`SELECT a.id,a.user_id,a.account_meta FROM user_trading_accounts a JOIN brokers b ON b.id=a.broker_id WHERE b.code='COINDCX' AND a.status IN ('verified','halted')`);
    const ids = new Set(accounts.map((a: any) => Number(a.id)));
    for (const [id,session] of this.sessions) if (!ids.has(id)) { await session.close(); this.sessions.delete(id); }
    for (const account of accounts) {
      const id = Number(account.id), userId = Number(account.user_id);
      const fingerprint = crypto.createHash("sha256").update(JSON.stringify(account.account_meta?.coindcx ?? {})).digest("hex");
      if (this.sessions.get(id)?.fingerprint === fingerprint) continue;
      if (this.sessions.has(id)) { await this.sessions.get(id)!.close(); this.sessions.delete(id); }
      const runner = this.lockRunner;
      const [lock] = await runner.query(`SELECT pg_try_advisory_lock(73003,$1::int) AS acquired`, [id]);
      if (!lock.acquired) continue;
      const closeSockets: (() => void)[] = [];
      let timer: NodeJS.Timeout | undefined;
      let closed = false;
      const close = async () => { closed = true; if (timer) clearTimeout(timer); closeSockets.forEach(closeSocket => closeSocket()); await runner.query(`SELECT pg_advisory_unlock(73003,$1::int)`, [id]).catch(() => {}); };
      try {
        const credentials = await new CoinDCXService().getStreamCredentials(userId,id);
        const authSignature = crypto.createHmac("sha256", credentials.apiSecret).update(JSON.stringify({ channel: "coindcx" })).digest("hex");
        const changed = (kind: string) => {
          void publishTradeEvent(userId,id,kind).catch(() => {});
          if (timer || closed) return;
          timer = setTimeout(() => {
            timer = undefined;
            void new ReconciliationService().run(id).then(() => publishTradeEvent(userId,id,"reconciled")).catch(() => {});
          }, 100);
        };
        for (const [factory,endpoint] of [[io,"https://stream-spot.coindcx.com"],[legacyIo,"https://stream.coindcx.com"]] as const) {
          const socket = factory(endpoint,{ transports:["websocket"], autoConnect:false, forceNew:true, reconnection:true, reconnectionAttempts:Infinity, reconnectionDelay:1000, reconnectionDelayMax:30000, randomizationFactor:0.5, timeout:15000 });
          closeSockets.push(bindCoinDCXStream(socket, {authSignature,apiKey:credentials.apiKey}, changed, () => {
            void publishTradeEvent(userId,id,"stream-unavailable").catch(() => {});
          }));
          socket.connect();
        }
        this.sessions.set(id,{fingerprint,close});
      } catch (error) { await close(); console.error("[COINDCX-STREAM] connection setup failed", { accountId:id, error: error instanceof Error ? error.message : "credential_error" }); }
    }
  }
}
