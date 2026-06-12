# Trading Server API Curl Guide

This guide is for UI developers and admin-panel developers working with `trading_server`.

Base URL used in examples:

```bash
export BASE_URL="https://backend.tradebro.io"
```

Use bearer auth for most protected routes:

```bash
export ACCESS_TOKEN="paste_user_or_admin_access_token_here"
export ADMIN_ACCESS_TOKEN="paste_admin_access_token_here"
```

Some auth routes use cookies. When that matters, the curl example includes a `Cookie:` header.

## Quick auth setup

### Register with email and password

```bash
curl --request POST "$BASE_URL/user/register" \
  --header "Content-Type: application/json" \
  --data '{
    "email": "ui.user@example.com",
    "password": "StrongPassword@123",
    "name": "UI User",
    "referralCode": "ABCD1234"
  }'
```

### Register with provider payload through `/user/register`

```bash
curl --request POST "$BASE_URL/user/register" \
  --header "Content-Type: application/json" \
  --data '{
    "provider": "google",
    "providerUserId": "google-sub-123",
    "email": "provider.user@example.com",
    "name": "Provider User",
    "referralCode": "ABCD1234"
  }'
```

### Verify email

```bash
curl "$BASE_URL/user/verify-email?token=EMAIL_VERIFICATION_TOKEN"
```

### Login with email and password

```bash
curl --request POST "$BASE_URL/auth/login" \
  --header "Content-Type: application/json" \
  --data '{
    "email": "ui.user@example.com",
    "password": "StrongPassword@123"
  }'
```

Typical response includes user info plus `access` and `refresh` tokens inside the response body, and also sets auth cookies.

### Login with Google

```bash
curl --request POST "$BASE_URL/auth/google" \
  --header "Content-Type: application/json" \
  --data '{
    "id_token": "GOOGLE_ID_TOKEN",
    "referralCode": "ABCD1234"
  }'
```

### Refresh auth using refresh cookie

```bash
curl --request POST "$BASE_URL/auth/refresh" \
  --header "Cookie: refresh_token=PASTE_REFRESH_TOKEN_HERE"
```

### Revoke session / logout

```bash
curl --request POST "$BASE_URL/auth/revoke" \
  --header "Cookie: refresh_token=PASTE_REFRESH_TOKEN_HERE"
```

### Auth me

```bash
curl "$BASE_URL/auth/me" \
  --header "Cookie: access_token=PASTE_ACCESS_TOKEN_HERE"
```

## User profile and settings APIs

### Get current user profile

```bash
curl "$BASE_URL/user/me" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Get dashboard

```bash
curl "$BASE_URL/user/dashboard" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Get settings page payload

This is the main grouped settings payload for the UI.

```bash
curl "$BASE_URL/user/settings" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

Expected response groups:

```json
{
  "message": "Settings fetched successfully",
  "data": {
    "trade": { "allowTrade": true },
    "copyTrade": { "allowCopyTrade": true },
    "edging": {
      "isEnabled": false,
      "notes": null,
      "updatedAt": "2026-04-19T00:00:00.000Z"
    },
    "riskLimits": {
      "isEnabled": true,
      "dailyLossLimit": 1000,
      "dailyProfitTarget": 3000,
      "maxTradesPerDay": 8,
      "cooldownAfterLossMins": 30
    },
    "wallet": {
      "currency": "INR",
      "totalEarned": 0,
      "pendingRewards": 0,
      "withdrawableAmount": 0,
      "lockedWithdrawalAmount": 0,
      "totalWithdrawn": 0,
      "minWithdrawalAmount": 500,
      "holdDays": 7
    },
    "accounts": []
  }
}
```

### Get referral summary for logged-in user

```bash
curl "$BASE_URL/user/referral" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Get billing details

```bash
curl "$BASE_URL/user/billing" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Create or update billing details

Used for bank-account withdrawal details.

```bash
curl --request PUT "$BASE_URL/user/billing" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "panNumber": "ABCDE1234F",
    "accountHolderName": "UI User",
    "accountNumber": "123456789012",
    "ifscCode": "HDFC0001234",
    "bankName": "HDFC Bank",
    "branch": "Bangalore Main",
    "addressLine1": "123 Example Street",
    "addressLine2": "Near Example Circle",
    "city": "Bangalore",
    "state": "Karnataka",
    "pincode": "560001"
  }'
```

### Global trade on/off

This updates `users.allow_trade` and all owned trading accounts `is_enabled`.

```bash
curl --request PUT "$BASE_URL/user/trade-status" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "allowTrade": false
  }'
```

### Global copy-trade on/off

```bash
curl --request PUT "$BASE_URL/user/copy-trade-status" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "allowCopyTrade": true
  }'
```

### Get edging status

```bash
curl "$BASE_URL/user/edging-status" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Update edging status

```bash
curl --request PUT "$BASE_URL/user/edging-status" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "isEnabled": true,
    "notes": "Temporarily enabled from settings page"
  }'
```

### Update risk limits

```bash
curl --request PUT "$BASE_URL/user/risk-limits" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "isEnabled": true,
    "dailyLossLimit": 1000,
    "dailyProfitTarget": 3000,
    "maxTradesPerDay": 8,
    "cooldownAfterLossMins": 30
  }'
```

## Plan APIs

Mounted under `/admin/plans`.

### List active plans for the app

```bash
curl "$BASE_URL/admin/plans/subscription-plan/list" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

Optional query params:

```bash
curl "$BASE_URL/admin/plans/subscription-plan/list?chunkSize=10&initialOffset=0&searchParam=crypto&planTypeCode=PREMIUM&marketCode=CRYPTO" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### List all plans

```bash
curl "$BASE_URL/admin/plans/subscription-plan/all" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Get single plan

```bash
curl "$BASE_URL/admin/plans/subscription-plan/5" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

## Payment, wallet, and withdrawal APIs

### Create Razorpay checkout

This is the main UI payment-start endpoint.

```bash
curl --request POST "$BASE_URL/billing/subscription/checkout" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "planId": 5
  }'
```

Typical success response:

```json
{
  "message": "Checkout created",
  "data": {
    "keyId": "rzp_test_xxxxx",
    "orderId": "order_xxxxx",
    "amount": 99900,
    "currency": "INR",
    "invoiceId": 16,
    "planId": 5,
    "planName": "CRYPTO Basic"
  }
}
```

### Verify Razorpay payment after frontend checkout success

```bash
curl --request POST "$BASE_URL/billing/subscription/verify" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "razorpay_order_id": "order_xxxxx",
    "razorpay_payment_id": "pay_xxxxx",
    "razorpay_signature": "generated_signature",
    "invoiceId": 16
  }'
```

### Get current subscription using billing flow

```bash
curl "$BASE_URL/billing/subscription/current" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Cancel current subscription using billing flow

Soft cancel:

```bash
curl --request POST "$BASE_URL/billing/subscription/cancel" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "immediate": false
  }'
```

Immediate cancel:

```bash
curl --request POST "$BASE_URL/billing/subscription/cancel" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "immediate": true
  }'
```

### Get wallet summary

```bash
curl "$BASE_URL/billing/wallet" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### List my withdrawal requests

```bash
curl "$BASE_URL/billing/withdrawals" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Create withdrawal request

```bash
curl --request POST "$BASE_URL/billing/withdrawals" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "amount": 500
  }'
```

## Trading account APIs

Mounted under `/trading-accounts`.

### List my trading accounts for a plan

`planId` is required.

```bash
curl "$BASE_URL/trading-accounts?planId=5" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Get one trading account

```bash
curl "$BASE_URL/trading-accounts/12" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Create trading account

Minimal example:

```bash
curl --request POST "$BASE_URL/trading-accounts" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "broker": "COINDCX",
    "accountLabel": "Main Crypto Account",
    "accountId": "my-coindcx-account",
    "apiKey": "broker_api_key",
    "apiSecret": "broker_api_secret",
    "isMaster": true,
    "executionFlow": "SELF",
    "accountMeta": {
      "coindcx": {
        "apiKey": "broker_api_key",
        "apiSecret": "broker_api_secret"
      }
    }
  }'
```

### Update trading account

```bash
curl --request PATCH "$BASE_URL/trading-accounts/12" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "accountLabel": "Updated Account Label",
    "isEnabled": true,
    "isMaster": false,
    "executionFlow": "SELF"
  }'
```

### Delete trading account

```bash
curl --request DELETE "$BASE_URL/trading-accounts/12" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Approve or reject a copy-trading request received by the master user

```bash
curl --request POST "$BASE_URL/trading-accounts/allow-copy-trading" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "requestId": 77,
    "approve": true
  }'
```

### List copy-trading requests

```bash
curl "$BASE_URL/trading-accounts/copy-trading-requests" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Create copy-trading request from follower side

```bash
curl --request POST "$BASE_URL/trading-accounts/handle-copy-trading-request" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "userTradingAccountId": 12,
    "userEmail": "master.user@example.com"
  }'
```

## Trade APIs

Mounted under `/trade`.

### List active/open trades

`accountId` is required.

```bash
curl "$BASE_URL/trade/all?accountId=12&start=0&count=10&status=OPEN" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Get one trade by signal id

```bash
curl "$BASE_URL/trade?signalId=12345" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Get trade history

```bash
curl "$BASE_URL/trade/history?accountId=12&start=0&count=20&status=CLOSED" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Close one or more trades

Close selected trades:

```bash
curl --request POST "$BASE_URL/trade/close" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "signalIds": [12345, 12346],
    "isCloseAll": false
  }'
```

Close all:

```bash
curl --request POST "$BASE_URL/trade/close" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "signalIds": [],
	  "isCloseAll": true
	}'
```

### Admin: list strategy parent trades

These rows are admin strategy placements. They do not require an admin trading account.

```bash
curl --request GET "$BASE_URL/trade/admin/strategy-trades?strategyId=1&planId=1&status=blocked&start=0&count=20" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  --header "Accept: application/json"
```

Filters: `strategyId`, `planId`, `status`, `from`, `to`, `start`, `count`.

### Admin: get one strategy parent trade with user child trades

```bash
curl --request GET "$BASE_URL/trade/admin/strategy-trades/1" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  --header "Accept: application/json"
```

### Admin: close all user trades from one strategy parent trade

This queues all linked `completed` user trades as `pending_close`. Broker listeners process the actual close. No account id and no request body are required.

```bash
curl --request POST "$BASE_URL/trade/admin/strategy-trades/1/close" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  --header "Accept: application/json"
```

For a standalone Postman-ready guide, see `docs/admin-strategy-trades-api-curls.md`.

## Support ticket APIs

Mounted under `/support`.

### Create ticket

```bash
curl --request POST "$BASE_URL/support/tickets" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "subject": "Payment not reflected",
    "message": "I completed payment but subscription is still pending.",
    "category": "billing",
    "priority": "high"
  }'
```

### List my tickets

```bash
curl "$BASE_URL/support/tickets" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Get ticket by id

```bash
curl "$BASE_URL/support/tickets/10" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Add message to a ticket

```bash
curl --request POST "$BASE_URL/support/tickets/10/messages" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "message": "Attaching more details from the payment screen."
  }'
```

## Strategy APIs

Mounted under `/strategy`.

Admin controls all strategy catalog records. Catalog changes are used for new subscriptions; existing user strategy instances keep their frozen params/version and continue based on their own instance status.

### List strategies

Admins can list all strategies and filter them. Normal users receive only active, non-deprecated strategies.

```bash
curl "$BASE_URL/strategy?isActive=true&isDeprecated=false&category=forex&chunkSize=20&initialOffset=0" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Get strategy by id

```bash
curl "$BASE_URL/strategy/4" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Create strategy

```bash
curl --request POST "$BASE_URL/strategy" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "strategyCode": "EMA_TREND",
    "name": "EMA Trend",
    "description": "Trend-following EMA strategy",
    "category": "forex",
    "version": 1,
    "defaultParams": {
      "risk": "medium"
    },
    "riskProfile": "medium",
    "capitalRequirement": 1000,
    "isActive": true,
    "isDeprecated": false,
    "isCopyable": true
  }'
```

### Update strategy

```bash
curl --request PATCH "$BASE_URL/strategy/4" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "version": 2,
    "defaultParams": {
      "risk": "low"
    },
    "capitalRequirement": 1500
  }'
```

### Soft retire strategy

This sets `isActive=false` and `isDeprecated=true`; it does not delete existing user strategy instances.

```bash
curl --request DELETE "$BASE_URL/strategy/4" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Enable strategy by strategy id

For admin this enables the global strategy catalog item.
For a normal user this enables the user-owned strategy instance resolved from the strategy id.

```bash
curl --request PATCH "$BASE_URL/strategy/4/enable" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Disable strategy by strategy id

```bash
curl --request PATCH "$BASE_URL/strategy/4/disable" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Enable strategy instance directly

```bash
curl --request PATCH "$BASE_URL/strategy/instance/21/enable" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Disable strategy instance directly

```bash
curl --request PATCH "$BASE_URL/strategy/instance/21/disable" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Update strategy instance volume

```bash
curl --request PATCH "$BASE_URL/strategy/instance/21/volume" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "volume": 0.05
  }'
```

## Legacy subscription APIs still mounted

Mounted from `UserSubscriptionRouter` at root.

These still exist and may be used by older clients. New payment-first UI should prefer the `/billing/subscription/*` routes for checkout and verification.

### Create subscription directly

```bash
curl --request POST "$BASE_URL/subscription/subscribe" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "planId": 5,
    "executionEnabled": true,
    "autoRenew": true
  }'
```

### Cancel subscription directly

```bash
curl --request POST "$BASE_URL/subscription/cancel" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "subscriptionId": 18
  }'
```

### Get current subscription directly

```bash
curl "$BASE_URL/subscription/current?start=0&count=20" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

### Get follower trading accounts for current user

```bash
curl "$BASE_URL/subscription/follower-user-trading-account?start=0&count=20" \
  --header "Authorization: Bearer $ACCESS_TOKEN"
```

## Admin APIs

Use admin token:

```bash
export ACCESS_TOKEN="$ADMIN_ACCESS_TOKEN"
```

### List users

```bash
curl "$BASE_URL/user?page=1&limit=20&search=abhi" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN"
```

This list now includes:

- `referralCode`
- `referredByUserId`
- `level1ReferralCount`
- `level2ReferralCount`

### Get referral tree for any user

```bash
curl "$BASE_URL/user/2/referral" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN"
```

### Promote or demote admin

```bash
curl --request PATCH "$BASE_URL/user/2/admin" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "isAdmin": true
  }'
```

### Create subscription plan

```bash
curl --request POST "$BASE_URL/admin/plans/subscription-plan" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "name": "CRYPTO Ultra",
    "description": "Ultra plan for crypto users",
    "isActive": true,
    "metadata": {
      "tier": "ultra",
      "market": "CRYPTO"
    },
    "planTypeCode": "PREMIUM",
    "marketCode": "CRYPTO",
    "pricing": {
      "priceInr": 2499,
      "currency": "INR",
      "interval": "monthly",
      "isFree": false
    },
    "limits": {
      "maxConnectedAccounts": 5,
      "maxDailyTrades": 20
    },
    "features": {
      "WEBHOOK_EXECUTION": "ENABLED",
      "REFERRAL_EARNINGS": "ENABLED"
    },
    "strategyId": 4
  }'
```

### Update subscription plan

```bash
curl --request PATCH "$BASE_URL/admin/plans/subscription-plan/5" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "name": "CRYPTO Basic Updated",
    "description": "Updated copy",
    "isActive": true,
    "pricing": {
      "priceInr": 1099
    },
    "limits": {
      "maxConnectedAccounts": 3
    },
    "features": {
      "WEBHOOK_EXECUTION": "ENABLED"
    }
  }'
```

### Deactivate plan

```bash
curl --request DELETE "$BASE_URL/admin/plans/subscription-plan/5" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN"
```

### Get plan admin webhook token

```bash
curl "$BASE_URL/admin/plans/subscription-plan/5/webhook-token" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN"
```

### Rotate plan admin webhook token

```bash
curl --request POST "$BASE_URL/admin/plans/subscription-plan/5/webhook-token/rotate" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN"
```

### Get subscriptions for one user

```bash
curl "$BASE_URL/admin/subscription/user/2" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN"
```

### Get all subscriptions

```bash
curl "$BASE_URL/admin/subscription/all?offset=0&limit=20" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN"
```

### Update subscription webhook flag

```bash
curl --request POST "$BASE_URL/admin/subscription/update-webhook" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "subscriptionId": 18,
    "isWebhookEnabled": true
  }'
```

### List all withdrawal requests for admin review

```bash
curl "$BASE_URL/billing/admin/withdrawals" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN"
```

### Approve withdrawal request

```bash
curl --request PATCH "$BASE_URL/billing/admin/withdrawals/15/approve" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "notes": "Approved by finance admin"
  }'
```

### Reject withdrawal request

```bash
curl --request PATCH "$BASE_URL/billing/admin/withdrawals/15/reject" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "notes": "Bank details mismatch"
  }'
```

### Update minimum withdrawal setting

```bash
curl --request PUT "$BASE_URL/billing/admin/withdrawal-settings" \
  --header "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "minWithdrawalAmountInr": 500
  }'
```

## Internal webhook and integration APIs

These are not for the frontend UI, but ops or partner systems may need them.

### Razorpay payment webhook

```bash
curl --request POST "$BASE_URL/billing/razorpay/webhook" \
  --header "Content-Type: application/json" \
  --header "x-razorpay-signature: GENERATED_SIGNATURE" \
  --data '{"event":"payment.captured","payload":{}}'
```

### RazorpayX payout webhook

```bash
curl --request POST "$BASE_URL/billing/razorpayx/webhook" \
  --header "Content-Type: application/json" \
  --header "x-razorpay-signature: GENERATED_SIGNATURE" \
  --data '{"event":"payout.processed","payload":{}}'
```

### CRM support ticket upsert

```bash
curl --request POST "$BASE_URL/integrations/crm/support/tickets/upsert" \
  --header "Content-Type: application/json" \
  --header "x-api-secret: CRM_INTEGRATION_SECRET" \
  --data '{
    "crmTicketId": "CRM-1001",
    "email": "ui.user@example.com",
    "subject": "Imported from CRM",
    "status": "open"
  }'
```

### CRM support public reply ingest

```bash
curl --request POST "$BASE_URL/integrations/crm/support/tickets/CRM-1001/public-replies" \
  --header "Content-Type: application/json" \
  --header "x-api-secret: CRM_INTEGRATION_SECRET" \
  --data '{
    "message": "This is a public reply from CRM."
  }'
```

## Notes for UI team

- Prefer bearer auth in app-side API wrappers for protected routes.
- For payment flow, call:
  1. `POST /billing/subscription/checkout`
  2. open Razorpay checkout using returned `keyId`, `orderId`, `amount`, `currency`
  3. `POST /billing/subscription/verify`
  4. refetch `GET /billing/subscription/current`, `GET /user/settings`, and optionally `GET /billing/wallet`
- For settings page, `GET /user/settings` should be your primary read API.
- For withdraw flow, UI should ensure billing details are filled through `PUT /user/billing` before calling `POST /billing/withdrawals`.
- Some legacy subscription routes still exist. New payment UI should prefer billing routes where both old and new paths overlap.
