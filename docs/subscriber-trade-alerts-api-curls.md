# Subscriber Trade Alerts API Curls

Subscriber trade alerts are created automatically when a new `BUY` or `SELL`
trade signal is created for a subscriber. They are not the same as inbound
TradingView alert snapshots under `/tradingview/alerts`.

Base URL:

```bash
export BASE_URL="https://backend.tradebro.io"
export USER_ACCESS_TOKEN="YOUR_USER_ACCESS_TOKEN"
export TRADE_ALERT_ID="1"
```

Postman variables:

```text
baseUrl = https://backend.tradebro.io
userAccessToken = YOUR_USER_ACCESS_TOKEN
tradeAlertId = 1
```

## 1. List Subscriber Trade Alerts

Endpoint:

```text
GET /trade/alerts
```

Query params:

```text
start       optional, offset, default 0
count       optional, limit, default 20
unreadOnly  optional, true | false, default false
```

Postman cURL:

```bash
curl --request GET "{{baseUrl}}/trade/alerts?start=0&count=20&unreadOnly=false" \
  --header "Authorization: Bearer {{userAccessToken}}" \
  --header "Accept: application/json"
```

Bash cURL:

```bash
curl --request GET "$BASE_URL/trade/alerts?start=0&count=20&unreadOnly=false" \
  --header "Authorization: Bearer $USER_ACCESS_TOKEN" \
  --header "Accept: application/json"
```

Example response shape:

```json
{
  "data": [
    {
      "id": "1",
      "tradeSignalId": 12345,
      "eventType": "trade_placed",
      "action": "BUY",
      "symbol": "EURUSD",
      "exchange": "FX",
      "price": "1.08100",
      "volume": "0.01",
      "isRead": false,
      "readAt": null,
      "createdAt": "2026-05-17T10:00:05.000Z"
    }
  ],
  "pagination": {
    "start": 0,
    "count": 20,
    "total": 1
  },
  "unreadCount": 1
}
```

## 2. List Only Unread Alerts

Postman cURL:

```bash
curl --request GET "{{baseUrl}}/trade/alerts?start=0&count=20&unreadOnly=true" \
  --header "Authorization: Bearer {{userAccessToken}}" \
  --header "Accept: application/json"
```

Bash cURL:

```bash
curl --request GET "$BASE_URL/trade/alerts?start=0&count=20&unreadOnly=true" \
  --header "Authorization: Bearer $USER_ACCESS_TOKEN" \
  --header "Accept: application/json"
```

## 3. Mark One Alert As Read

Endpoint:

```text
PATCH /trade/alerts/:alertId/read
```

Postman cURL:

```bash
curl --request PATCH "{{baseUrl}}/trade/alerts/{{tradeAlertId}}/read" \
  --header "Authorization: Bearer {{userAccessToken}}" \
  --header "Accept: application/json"
```

Bash cURL:

```bash
curl --request PATCH "$BASE_URL/trade/alerts/$TRADE_ALERT_ID/read" \
  --header "Authorization: Bearer $USER_ACCESS_TOKEN" \
  --header "Accept: application/json"
```

## 4. Mark All Alerts As Read

Endpoint:

```text
PATCH /trade/alerts/read-all
```

Postman cURL:

```bash
curl --request PATCH "{{baseUrl}}/trade/alerts/read-all" \
  --header "Authorization: Bearer {{userAccessToken}}" \
  --header "Accept: application/json"
```

Bash cURL:

```bash
curl --request PATCH "$BASE_URL/trade/alerts/read-all" \
  --header "Authorization: Bearer $USER_ACCESS_TOKEN" \
  --header "Accept: application/json"
```
