# Admin Strategy Trades API Curls

This document covers the three admin APIs used to list, inspect, and close user trades that were created from one admin strategy placement.

Base URL:

```bash
export BASE_URL="https://backend.tradebro.io"
export ADMIN_ACCESS_TOKEN="YOUR_ADMIN_ACCESS_TOKEN"
export ADMIN_STRATEGY_TRADE_ID="1"
```

Postman variables:

```text
baseUrl = https://backend.tradebro.io
adminAccessToken = YOUR_ADMIN_ACCESS_TOKEN
adminStrategyTradeId = 1
```

Current sample IDs from the database:

```text
strategyId = 1
planId = 1
adminStrategyTradeId = 1
status = blocked
```

Strategy IDs:

```text
1 = Forex Trend Swing
2 = Forex London Breakout
3 = Crypto Momentum
4 = Crypto Mean Reversion
5 = India Equity Intraday
6 = India Equity Swing
```

Notes:

- These APIs are admin-only.
- `adminStrategyTradeId` is the parent trade id from `admin_strategy_trades.id`.
- The admin parent trade does not require an admin trading account.
- User trades remain in `trade_signals` and are linked by `trade_signals.admin_strategy_trade_id`.
- A `blocked` parent trade may have snapshots but zero user trade signals, so close will not queue anything for that parent.

## 1. List Admin Strategy Parent Trades

Endpoint:

```text
GET /trade/admin/strategy-trades
```

Query params:

```text
strategyId  optional, number
planId      optional, number
status      optional, received | blocked | fanned_out | no_signals | close_requested
from        optional, ISO date/time
to          optional, ISO date/time
start       optional, offset, default 0
count       optional, limit, default 20
```

Postman cURL:

```bash
curl --request GET "{{baseUrl}}/trade/admin/strategy-trades?strategyId=1&planId=1&status=blocked&start=0&count=20" \
  --header "Authorization: Bearer {{adminAccessToken}}" \
  --header "Accept: application/json"
```

Bash cURL:

```bash
curl --request GET "$BASE_URL/trade/admin/strategy-trades?strategyId=1&planId=1&status=blocked&start=0&count=20" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  --header "Accept: application/json"
```

Example response shape:

```json
{
  "data": [
    {
      "id": "1",
      "planId": "1",
      "strategyId": "1",
      "action": "SELL",
      "symbol": "EURUSD",
      "status": "blocked",
      "recipientCount": 0,
      "snapshotCount": 2,
      "signalCount": 0,
      "closeQueuedCount": 0,
      "createdAt": "2026-05-01T13:08:54.201Z"
    }
  ],
  "pagination": {
    "start": 0,
    "count": 20,
    "total": 1
  }
}
```

## 2. Get One Parent Trade With Linked User Trades

Endpoint:

```text
GET /trade/admin/strategy-trades/:adminStrategyTradeId
```

Postman cURL:

```bash
curl --request GET "{{baseUrl}}/trade/admin/strategy-trades/{{adminStrategyTradeId}}" \
  --header "Authorization: Bearer {{adminAccessToken}}" \
  --header "Accept: application/json"
```

Bash cURL:

```bash
curl --request GET "$BASE_URL/trade/admin/strategy-trades/$ADMIN_STRATEGY_TRADE_ID" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  --header "Accept: application/json"
```

Example response shape:

```json
{
  "adminStrategyTrade": {
    "id": "1",
    "planId": "1",
    "strategyId": "1",
    "action": "SELL",
    "symbol": "EURUSD",
    "status": "blocked",
    "snapshotCount": 2,
    "signalCount": 0
  },
  "userTrades": []
}
```

## 3. Close User Trades From One Parent Trade

Endpoint:

```text
POST /trade/admin/strategy-trades/:adminStrategyTradeId/close
```

This endpoint does not need an account id and does not need a request body. It queues only linked user trades whose current status is `completed`; those trades become `pending_close`. Broker listeners process the actual broker close.

Postman cURL:

```bash
curl --request POST "{{baseUrl}}/trade/admin/strategy-trades/{{adminStrategyTradeId}}/close" \
  --header "Authorization: Bearer {{adminAccessToken}}" \
  --header "Accept: application/json"
```

Bash cURL:

```bash
curl --request POST "$BASE_URL/trade/admin/strategy-trades/$ADMIN_STRATEGY_TRADE_ID/close" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  --header "Accept: application/json"
```

Example response shape:

```json
{
  "adminStrategyTradeId": 1,
  "queuedCloseCount": 0,
  "skippedCount": 0,
  "signalIds": []
}
```

For real close testing, use an `adminStrategyTradeId` whose parent status is usually `fanned_out` and whose linked user trades have `completed` status.
