# MT5 EA Live Smoke Test

This smoke run verifies the versioned EA at `experts/mt5/SignalPollerEA.mq5` against the existing MT5 listener endpoints:

- `GET /signal?userId=<mt5-account-id>`
- `POST /signal/ack`
- `POST /signal/state`

Run this on an MT5 demo account first. Use a real account only after a separate human confirmation because market orders can execute immediately.

## MT5 Setup

1. Open MT5 and copy `experts/mt5/SignalPollerEA.mq5` into the terminal `MQL5/Experts` folder.
2. Compile it in MetaEditor.
3. In MT5, open `Tools -> Options -> Expert Advisors`.
4. Enable algorithmic trading and add the backend origin to `Allow WebRequest for listed URL`, for example:
   - `https://backend.globalalgotrading.com`
   - or the local/staging backend origin used for this test.
5. Attach the EA to a chart.
6. Set `UserId` to the MT5 trading account id stored in `user_trading_accounts.account_id`.
7. Add the symbols to `ExtraSymbolsCsv` if they are not already open in Market Watch or current positions.

## Required EA Inputs

- `SignalUrl`: backend `/signal` URL.
- `AckUrl`: backend `/signal/ack` URL.
- `StateUrl`: backend `/signal/state` URL.
- `UserId`: MT5 account id used by the backend.
- `MagicNumber`: fixed id for signals from this EA.
- `MaxDeviationPoints`: acceptable market-order slippage.
- `ExtraSymbolsCsv`: comma-separated symbols whose specs should be sent to `/signal/state`.

## Backend Checks

Before placing trades:

1. Confirm the MT5 trading account exists and uses broker code `MT5`.
2. Attach the EA and wait for one state sync.
3. Verify `mt5_symbols` has rows for the account and symbol.
4. Confirm no position-only `/signal/state` call clears those rows.

Useful SQL:

```sql
SELECT broker_account_id, symbol, digits, point, tick_size, pip_size
FROM mt5_symbols
WHERE broker_account_id = '<mt5-account-id>'
ORDER BY symbol;

SELECT ts.id, tss.status, ts.order_id, ts.broker_order_id, ts.broker_position_id, tss.last_error
FROM trade_signals ts
JOIN trade_signals_status tss ON tss.signal_id = ts.id
WHERE ts.trading_account_id = <trading-account-row-id>
ORDER BY ts.id DESC
LIMIT 20;
```

## Demo Flow

1. Market open:
   - Queue a small `MARKET` signal with `stopLossDistance` and `takeProfitDistance`.
   - Expected: EA sends success ACK; backend marks `completed`; `order_id` and `broker_order_id` are set, and `broker_position_id` is set when MT5 exposes the position ticket immediately.

2. Close open position:
   - Queue close for the completed trade.
   - Expected: `GET /signal` returns `executionMode: "CLOSE"` and a ticket resolved from `broker_position_id`, then `broker_order_id`, then `order_id`.
   - Expected: EA closes by position ticket or deletes a pending order by ticket; backend marks `closed`.

3. Limit pending order:
   - Queue a small `LIMIT` signal with `limitPrice`.
   - Expected: EA places a pending order; backend stores the MT5 order ticket.
   - Queue close for that signal.
   - Expected: EA deletes the pending order by ticket; backend marks `closed`.

4. Stop pending order:
   - Queue a small `STOP` signal with `stopPrice`.
   - Expected: EA places a pending order; backend stores the MT5 order ticket.
   - Queue close for that signal.
   - Expected: EA deletes the pending order by ticket; backend marks `closed`.

5. Controlled failure:
   - Queue `STOP_LIMIT` or `MARKET_RANGE`.
   - Expected: EA ACKs `error` with `unsupported_order_type_for_mt5_ea`; backend marks `failed` and writes `last_error`.

## Pass Criteria

- EA compiles in MetaEditor.
- `/signal/state` writes symbol specs and does not wipe them with position diagnostics.
- Market, limit, stop, close-position, and delete-pending-order flows all ACK correctly.
- Successful opens persist broker refs.
- Failed execution writes `trade_signals_status.last_error`.
- Hedging accounts do not close by symbol when more than one open position exists and no ticket is provided.

References:

- MT5 WebRequest: https://www.mql5.com/en/docs/network/webrequest
- MT5 CTrade: https://www.mql5.com/en/docs/standardlibrary/tradeclasses/ctrade
- MT5 order types: https://www.mql5.com/en/docs/constants/tradingconstants/orderproperties
- MT5 terminal global variables: https://www.mql5.com/en/docs/globals
