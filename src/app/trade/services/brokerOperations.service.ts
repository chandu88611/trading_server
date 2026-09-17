import AppDataSource from "../../../db/data-source";

export function brokerRows(value: any): any[] {
  if (Array.isArray(value)) return value;
  for (const key of ["data", "orders", "positions", "activeOrders", "trades"]) if (value?.[key]) return brokerRows(value[key]);
  return [];
}

export class BrokerOperationsService {
  async client(account: any): Promise<any> {
    const code = String(account.broker?.code).toUpperCase();
    if (code === "COINDCX") return new (await import("../../coindcx/services/coindcx.service")).CoinDCXService();
    if (code === "ZEBU") return new (await import("../../zebu/services/zebu.service")).ZebuService();
    if (code === "DHAN") return new (await import("../../dhan/services/dhan.service")).DhanService();
    throw new Error(`broker_books_unavailable:${code}`);
  }

  async halt(account: any): Promise<{ confirmed: boolean; message?: string; openPositions?: number }> {
    const code = String(account.broker?.code).toUpperCase();
    const [state] = await AppDataSource.query(`SELECT detail FROM trading_emergency_halts WHERE account_id=$1`, [account.id]);
    if (["CTRADER", "MT5"].includes(code)) {
      await AppDataSource.query(`UPDATE trade_signals_status s SET status='pending_close',updated_at=now() FROM trade_signals t WHERE s.signal_id=t.id AND t.trading_account_id=$1 AND s.status='completed'`, [account.id]);
      return { confirmed: false, message: "Exits queued to existing Forex worker; gateway/EA must confirm broker books and cancel resting orders." };
    }
    const client = await this.client(account);
    const orders = brokerRows(await client.getOrders(Number(account.userId), account.id));
    for (const order of state?.detail?.submitted ? [] : orders) {
      const status = String(order.status ?? order.orderStatus ?? "").toLowerCase();
      if (["filled","traded","complete","completed","cancelled","canceled","rejected"].includes(status)) continue;
      await client.cancelOrder({ userId: Number(account.userId), tradingAccountId: account.id, orderId: String(order.id ?? order.orderId ?? order.norenordno) });
    }
    if (code === "COINDCX") {
      const positions = brokerRows(await client.getAllFuturesPositions({ userId: Number(account.userId), tradingAccountId: account.id }));
      const open = positions.filter(p => Number(p.active_pos ?? p.quantity ?? 0) !== 0);
      if (open.length && !state?.detail?.submitted) await this.markSubmitted(account.id);
      for (const p of state?.detail?.submitted ? [] : open) {
        if (!state?.detail?.submitted) await client.exitFuturesPosition({ userId: Number(account.userId), tradingAccountId: account.id, positionId: String(p.id) });
      }
      await AppDataSource.query(`UPDATE trade_signals_status s SET status='pending_close',updated_at=now() FROM trade_signals t WHERE s.signal_id=t.id AND t.trading_account_id=$1 AND s.status='completed' AND t.symbol NOT LIKE 'B-%' AND COALESCE(t.instrument_type,'')<>'FUTURES'`, [account.id]);
      const [local] = await AppDataSource.query(`SELECT count(*)::int AS n FROM trade_signals t JOIN trade_signals_status s ON s.signal_id=t.id WHERE t.trading_account_id=$1 AND s.status IN ('pending_close','in_progress_close','in_progress')`, [account.id]);
      if (open.length) await this.markSubmitted(account.id);
      return { confirmed: open.length === 0 && orders.length === 0 && local.n === 0, openPositions: open.length };
    }
    const positions = brokerRows(await client.getPositions(Number(account.userId), account.id));
    const open = positions.filter(p => Number(p.netQty ?? p.netqty ?? 0) !== 0);
    if (open.length && !state?.detail?.submitted) {
      // A durable intent prevents duplicate market closes on an ambiguous timeout.
      await this.markSubmitted(account.id);
      for (const p of open) {
        const qty = Number(p.netQty ?? p.netqty);
        await client.placeOrder({ userId: Number(account.userId), tradingAccountId: account.id, order: {
          symbol: String(p.securityId ?? p.tsym ?? p.tradingSymbol), exchange: p.exchangeSegment ?? p.exch,
          side: qty > 0 ? "SELL" : "BUY", quantity: Math.abs(qty), orderType: "MARKET",
          product: p.productType ?? p.prd, clientOrderId: `halt_${account.id}_${String(p.securityId ?? p.tsym)}`,
        } });
      }
    }
    return { confirmed: open.length === 0 && orders.every(o => ["traded","complete","filled","cancelled","canceled","rejected"].includes(String(o.status ?? o.orderStatus).toLowerCase())), openPositions: open.length, ...(open.length ? { message: "Awaiting broker confirmation; ambiguous closes require review." } : {}) };
  }
  private async markSubmitted(id: number) {
    await AppDataSource.query(`UPDATE trading_emergency_halts SET detail=detail||'{"submitted":true}'::jsonb WHERE account_id=$1`, [id]);
  }
}
