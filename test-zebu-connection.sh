#!/usr/bin/env bash

set -u

# Zebu smoke test script
# Usage:
#   ./test-zebu-connection.sh JWT_TOKEN TRADING_ACCOUNT_ID [ZEBU_ACCESS_TOKEN] [BASE_URL]
#
# Optional env:
#   ZEBU_PASSWORD=... ZEBU_FACTOR2=...                  Generate and store a fresh token.
#   ZEBU_UID=... ZEBU_ACTID=... ZEBU_BASE_URL=...       Save manual token metadata.
#   ZEBU_LIVE_ORDER_TESTS=true                          Run live order tests.
#   ZEBU_ALLOW_MARKET_ORDER=true                        Allow market order test.
#   ZEBU_TEST_SYMBOL=RELIANCE ZEBU_TEST_QTY=1           Live order instrument.
#   ZEBU_TEST_LIMIT_PRICE=1 ZEBU_TEST_TRIGGER_PRICE=1   Live order prices.

JWT_TOKEN="${1:-${JWT_TOKEN:-}}"
ACCOUNT_ID="${2:-${TRADING_ACCOUNT_ID:-1}}"
ZEBU_TOKEN="${3:-${ZEBU_ACCESS_TOKEN:-}}"
BASE_URL="${4:-${BASE_URL:-http://localhost:3000}}"

if [ -z "$JWT_TOKEN" ]; then
  echo "JWT token required as arg 1 or JWT_TOKEN env"
  exit 1
fi

api_request() {
  local method="$1"
  local path="$2"
  local body="${3:-}"

  if [ -n "$body" ]; then
    curl -sS -X "$method" "$BASE_URL$path" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -d "$body" \
      -w "\n%{http_code}"
  else
    curl -sS -X "$method" "$BASE_URL$path" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -w "\n%{http_code}"
  fi
}

print_response() {
  local title="$1"
  local response="$2"
  local status="${response##*$'\n'}"
  local body="${response%$'\n'*}"

  echo "$title"
  echo "$body"
  echo "Status: $status"
  echo ""
}

extract_order_id() {
  node -e '
    const fs = require("fs");
    const input = fs.readFileSync(0, "utf8").trim();
    if (!input) process.exit(0);
    const payload = JSON.parse(input);
    const orderId = payload?.data?.orderId || payload?.data?.raw?.norenordno || payload?.data?.raw?.result || "";
    process.stdout.write(String(orderId));
  ' 2>/dev/null
}

build_order_body() {
  node - "$@" <<'NODE'
const [
  tradingAccountId,
  symbol,
  exchange,
  side,
  quantity,
  orderType,
  product,
  price,
  triggerPrice,
  validity,
] = process.argv.slice(2);

const order = {
  symbol,
  exchange,
  side,
  quantity: Number(quantity),
  orderType,
  product,
  validity,
};

if (price !== "") order.price = Number(price);
if (triggerPrice !== "") order.triggerPrice = Number(triggerPrice);

process.stdout.write(JSON.stringify({
  tradingAccountId: Number(tradingAccountId),
  order,
}));
NODE
}

run_order_test() {
  local order_type="$1"
  local price="${2:-}"
  local trigger_price="${3:-}"
  local symbol="${ZEBU_TEST_SYMBOL:-}"
  local exchange="${ZEBU_TEST_EXCHANGE:-NSE}"
  local side="${ZEBU_TEST_SIDE:-BUY}"
  local qty="${ZEBU_TEST_QTY:-1}"
  local product="${ZEBU_TEST_PRODUCT:-C}"
  local validity="${ZEBU_TEST_VALIDITY:-DAY}"

  if [ -z "$symbol" ]; then
    echo "Skipping $order_type order: ZEBU_TEST_SYMBOL is required"
    echo ""
    return
  fi

  local body
  body="$(build_order_body "$ACCOUNT_ID" "$symbol" "$exchange" "$side" "$qty" "$order_type" "$product" "$price" "$trigger_price" "$validity")"
  local response
  response="$(api_request POST "/zebu/orders/place" "$body")"
  print_response "Live order test - $order_type" "$response"

  local status="${response##*$'\n'}"
  local json="${response%$'\n'*}"
  local order_id=""
  if [ "$status" = "200" ]; then
    order_id="$(printf "%s" "$json" | extract_order_id)"
  fi

  if [ "${ZEBU_CANCEL_AFTER_PLACE:-true}" = "true" ] && [ -n "$order_id" ]; then
    local cancel_body
    cancel_body="$(node -e 'process.stdout.write(JSON.stringify({tradingAccountId:Number(process.argv[1]),orderId:String(process.argv[2])}))' "$ACCOUNT_ID" "$order_id")"
    local cancel_response
    cancel_response="$(api_request POST "/zebu/orders/cancel" "$cancel_body")"
    print_response "Cancel order $order_id" "$cancel_response"
  fi
}

echo "=== Zebu Smoke Test ==="
echo "Base URL: $BASE_URL"
echo "Trading account ID: $ACCOUNT_ID"
echo ""

if [ -n "${ZEBU_PASSWORD:-}" ] && [ -n "${ZEBU_FACTOR2:-${ZEBU_TOTP:-}}" ]; then
  factor2="${ZEBU_FACTOR2:-${ZEBU_TOTP:-}}"
  auth_body="$(node -e 'process.stdout.write(JSON.stringify({tradingAccountId:Number(process.argv[1]),password:process.argv[2],factor2:process.argv[3]}))' "$ACCOUNT_ID" "$ZEBU_PASSWORD" "$factor2")"
  response="$(api_request POST "/zebu/auth/token/generate" "$auth_body")"
  print_response "Generate and save Zebu token" "$response"
elif [ -n "$ZEBU_TOKEN" ]; then
  save_body="$(node -e '
    const body = { tradingAccountId: Number(process.argv[1]), accessToken: process.argv[2] };
    if (process.argv[3]) body.uid = process.argv[3];
    if (process.argv[4]) body.actid = process.argv[4];
    if (process.argv[5]) body.baseUrl = process.argv[5];
    process.stdout.write(JSON.stringify(body));
  ' "$ACCOUNT_ID" "$ZEBU_TOKEN" "${ZEBU_UID:-}" "${ZEBU_ACTID:-}" "${ZEBU_BASE_URL:-}")"
  response="$(api_request POST "/zebu/auth/token" "$save_body")"
  print_response "Save pasted Zebu token" "$response"
else
  echo "Token step skipped. Set ZEBU_PASSWORD + ZEBU_FACTOR2, or pass/save ZEBU_ACCESS_TOKEN."
  echo ""
fi

response="$(api_request GET "/zebu/positions?tradingAccountId=$ACCOUNT_ID")"
print_response "Read positions" "$response"

response="$(api_request GET "/zebu/orders?tradingAccountId=$ACCOUNT_ID")"
print_response "Read orders" "$response"

response="$(api_request GET "/zebu/holdings?tradingAccountId=$ACCOUNT_ID")"
print_response "Read holdings" "$response"

if [ "${ZEBU_LIVE_ORDER_TESTS:-false}" = "true" ]; then
  echo "=== Live order tests enabled ==="
  run_order_test "LIMIT" "${ZEBU_TEST_LIMIT_PRICE:-}" ""
  run_order_test "SL-LMT" "${ZEBU_TEST_LIMIT_PRICE:-}" "${ZEBU_TEST_TRIGGER_PRICE:-}"
  run_order_test "SL-MKT" "" "${ZEBU_TEST_TRIGGER_PRICE:-}"

  if [ "${ZEBU_ALLOW_MARKET_ORDER:-false}" = "true" ]; then
    run_order_test "MARKET" "" ""
  else
    echo "Skipping MARKET order. Set ZEBU_ALLOW_MARKET_ORDER=true to allow immediate execution risk."
    echo ""
  fi
else
  echo "Live order tests skipped. Set ZEBU_LIVE_ORDER_TESTS=true to run them."
  echo ""
fi

echo "=== Zebu Smoke Test Complete ==="
