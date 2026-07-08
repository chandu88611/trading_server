# Indian Option Resolver

The Indian option resolver enriches simple Lux Algo direction alerts before
`trade_signals` are created. Zebu receives only the final broker-ready contract.

## Strategy Configuration

Enable the resolver in `strategies.default_params`:

```json
{
  "optionResolver": {
    "enabled": true,
    "instrumentType": "OPTIONS",
    "expiryMode": "NEAREST",
    "strikeMode": "ATM",
    "strikeOffsetSteps": 0,
    "defaultLots": 1,
    "candidateStrikesEachSide": 2,
    "minDaysToExpiry": 1,
    "minVolumeLots": 5,
    "minTopDepthLots": 1,
    "maxSpreadPercent": 3
  }
}
```

`ZEBU_MARKET_DATA_TRADING_ACCOUNT_ID` must identify a verified Zebu account
whose token can call `SearchScrip` and `GetQuotes`.

## Lux Webhook

```json
{
  "ticker": "RELIANCE",
  "action": "SELL",
  "exchange": "NSE",
  "product": "INTRADAY",
  "lots": 2,
  "strategy": "LUX_ALGO",
  "close": 1450
}
```

`BUY` resolves to a bought CE. `SELL` resolves to a bought PE. The original
direction is stored in `trade_signals.source_action`; the broker action is
always `BUY`.

## Instrument Sync

The server downloads Zebu-compatible `NFO`, `BFO`, and `MCX` masters at
08:00 Asia/Kolkata and at startup when the stored master is older than 24 hours.

Admins can force a sync:

```http
POST /admin/instruments/sync
Authorization: Bearer <admin-token>
Content-Type: application/json

{"segments":["NFO","BFO","MCX"]}
```

Resolver rejections return HTTP `422` and create no `trade_signals`.
