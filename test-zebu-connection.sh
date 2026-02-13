#!/bin/bash

# Test Zebu Connection Script
# Usage: ./test-zebu-connection.sh YOUR_JWT_TOKEN TRADING_ACCOUNT_ID ZEBU_ACCESS_TOKEN

JWT_TOKEN="${1:-YOUR_JWT_TOKEN}"
ACCOUNT_ID="${2:-1}"
ZEBU_TOKEN="${3}"
BASE_URL="${4:-http://localhost:3000}"

echo "=== Testing Zebu Connection ==="
echo "Base URL: $BASE_URL"
echo "Account ID: $ACCOUNT_ID"
echo ""

# Test 1: Save auth token if provided
if [ -n "$ZEBU_TOKEN" ]; then
  echo "1. Saving Zebu access token..."
  curl -X POST "$BASE_URL/zebu/auth/token" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -d "{
      \"tradingAccountId\": $ACCOUNT_ID,
      \"accessToken\": \"$ZEBU_TOKEN\"
    }" \
    -w "\nStatus: %{http_code}\n\n"
else
  echo "1. Skipping token save (no ZEBU_TOKEN provided)"
  echo ""
fi

# Test 2: Get positions
echo "2. Testing connection - Get Positions..."
curl -X GET "$BASE_URL/zebu/positions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "{
    \"tradingAccountId\": $ACCOUNT_ID
  }" \
  -w "\nStatus: %{http_code}\n\n"

# Test 3: Get orders
echo "3. Testing connection - Get Orders..."
curl -X GET "$BASE_URL/zebu/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "{
    \"tradingAccountId\": $ACCOUNT_ID
  }" \
  -w "\nStatus: %{http_code}\n\n"

# Test 4: Get holdings
echo "4. Testing connection - Get Holdings..."
curl -X GET "$BASE_URL/zebu/holdings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "{
    \"tradingAccountId\": $ACCOUNT_ID
  }" \
  -w "\nStatus: %{http_code}\n\n"

echo "=== Test Complete ==="
echo ""
echo "If you see HTTP 200 responses with data, Zebu is connected!"
echo "If you see 401 errors, check your Zebu access token"
echo "If you see 500 errors, check the server logs for details"
