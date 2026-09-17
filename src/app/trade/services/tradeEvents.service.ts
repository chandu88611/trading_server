import { EventEmitter } from "events";
import { Response } from "express";
import AppDataSource from "../../../db/data-source";
export const tradeEvents = new EventEmitter();
tradeEvents.setMaxListeners(1000);
let started = false;
export async function publishTradeEvent(userId: number, accountId: number, kind: string) {
  await AppDataSource.query(`SELECT pg_notify('trade_account_events',$1)`, [JSON.stringify({ userId, accountId, kind })]);
}
export async function startTradeEvents() {
  if (started) return;
  started = true;
  const runner = AppDataSource.createQueryRunner();
  try {
    const connection = await runner.connect();
    connection.on("notification", (message: { channel: string; payload?: string }) => {
      if (message.channel !== "trade_account_events") return;
      try { const event = JSON.parse(message.payload ?? "{}"); if (Number.isSafeInteger(event.userId)) tradeEvents.emit(String(event.userId), event); } catch { /* ignore malformed notifications */ }
    });
    const reconnect = () => { started = false; void runner.release().catch(() => {}); setTimeout(() => void startTradeEvents().catch(() => {}), 5000).unref(); };
    connection.once("error", reconnect);
    await runner.query("LISTEN trade_account_events");
  } catch (error) { started = false; await runner.release(); throw error; }
}
export function subscribeTradeEvents(userId: number, response: Response) {
  response.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  response.flushHeaders();
  response.write("retry: 3000\n\n");
  const send = (data: unknown) => response.write(`data: ${JSON.stringify(data)}\n\n`);
  tradeEvents.on(String(userId), send);
  const heartbeat = setInterval(() => response.write(": heartbeat\n\n"), 15000);
  response.on("close", () => { clearInterval(heartbeat); tradeEvents.off(String(userId), send); });
}
