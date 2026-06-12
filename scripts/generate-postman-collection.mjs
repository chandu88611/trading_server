import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(
  __dirname,
  "../postman/trading-server-full.postman_collection.json"
);

const bearer = (token) => ({
  type: "bearer",
  bearer: [{ key: "token", value: token, type: "string" }],
});

const authByType = {
  none: { type: "noauth" },
  user: bearer("{{userAccessToken}}"),
  admin: bearer("{{adminAccessToken}}"),
};

const jsonBody = (value) => ({
  mode: "raw",
  raw: JSON.stringify(value, null, 2),
  options: { raw: { language: "json" } },
});

const saveTokensScript = (sourcePath) => [
  "const json = pm.response.json();",
  `const source = ${sourcePath};`,
  "if (source?.access) pm.collectionVariables.set('userAccessToken', source.access);",
  "if (source?.refresh) pm.collectionVariables.set('refreshToken', source.refresh);",
];

const saveAdminTokensScript = (sourcePath) => [
  "const json = pm.response.json();",
  `const source = ${sourcePath};`,
  "if (source?.access) pm.collectionVariables.set('adminAccessToken', source.access);",
  "if (source?.refresh) pm.collectionVariables.set('adminRefreshToken', source.refresh);",
];

function buildUrl(url) {
  const [pathname, queryString = ""] = url.split("?");
  const pathParts = pathname.split("/").filter(Boolean);
  const query = queryString
    ? queryString.split("&").filter(Boolean).map((entry) => {
        const [key, ...rest] = entry.split("=");
        return {
          key,
          value: rest.join("="),
        };
      })
    : [];

  return {
    raw: `{{baseUrl}}${url}`,
    host: ["{{baseUrl}}"],
    path: pathParts,
    ...(query.length ? { query } : {}),
  };
}

function request(
  name,
  method,
  url,
  { auth = "none", body, headers = [], description, testScript } = {}
) {
  const requestHeaders = [...headers];
  if (body !== undefined && !requestHeaders.some((header) => header.key === "Content-Type")) {
    requestHeaders.unshift({ key: "Content-Type", value: "application/json" });
  }

  const item = {
    name,
    request: {
      method,
      header: requestHeaders,
      auth: authByType[auth] ?? authByType.none,
      url: buildUrl(url),
    },
  };

  if (body !== undefined) item.request.body = jsonBody(body);
  if (description) item.request.description = description;
  if (testScript?.length) {
    item.event = [
      {
        listen: "test",
        script: {
          type: "text/javascript",
          exec: testScript,
        },
      },
    ];
  }
  return item;
}

const folder = (name, item, description) => ({
  name,
  ...(description ? { description } : {}),
  item,
});

const alertBody = {
  market: "FOREX",
  ticker: "EURUSD",
  exchange: "FX",
  interval: "15m",
  barTime: "2026-05-16T10:00:00.000Z",
  alertTime: "2026-05-16T10:00:05.000Z",
  open: 1.08,
  close: 1.081,
  high: 1.082,
  low: 1.079,
  volume: 1000,
  action: "BUY",
  executionMode: "OPEN",
  tradingStrength: 0.8,
};

const orderBody = {
  tradingAccountId: "{{accountId}}",
  order: {
    symbol: "RELIANCE",
    exchange: "NSE",
    side: "BUY",
    quantity: 1,
    orderType: "MARKET",
    product: "INTRADAY",
  },
};

const coinDcxOrderBody = {
  tradingAccountId: "{{accountId}}",
  order: {
    symbol: "BTCINR",
    side: "BUY",
    quantity: 0.001,
    orderType: "MARKET",
  },
};

const collection = {
  info: {
    _postman_id: "4df56c4c-43e2-4d1e-9370-5a8f31d5cf01",
    name: "Trading Server Full API",
    description:
      "Complete Postman collection generated from the currently mounted trading_server routes. Includes public, user, admin, broker, webhook, support, cTrader, MT5, and broker-integration endpoints.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:3000" },
    { key: "userEmail", value: "user@example.com" },
    { key: "userPassword", value: "StrongPassword@123" },
    { key: "userName", value: "Example User" },
    { key: "adminEmail", value: "admin@example.com" },
    { key: "adminPassword", value: "StrongPassword@123" },
    { key: "userAccessToken", value: "" },
    { key: "refreshToken", value: "" },
    { key: "adminAccessToken", value: "" },
    { key: "adminRefreshToken", value: "" },
    { key: "emailVerificationToken", value: "" },
    { key: "referralCode", value: "ABCD1234" },
    { key: "googleIdToken", value: "" },
    { key: "userId", value: "2" },
    { key: "planId", value: "5" },
    { key: "strategyId", value: "4" },
    { key: "strategyInstanceId", value: "21" },
    { key: "subscriptionId", value: "18" },
    { key: "accountId", value: "12" },
    { key: "requestId", value: "77" },
    { key: "ticketId", value: "10" },
    { key: "crmTicketId", value: "CRM-1001" },
    { key: "withdrawalId", value: "15" },
    { key: "credentialId", value: "1" },
    { key: "brokerJobId", value: "1" },
    { key: "signalId", value: "12345" },
    { key: "tradeAlertId", value: "1" },
    { key: "adminStrategyTradeId", value: "1" },
    { key: "subscriberWebhookToken", value: "" },
    { key: "planWebhookToken", value: "" },
    { key: "razorpaySignature", value: "" },
    { key: "crmIntegrationSecret", value: "my_secret" },
    { key: "internalApiKey", value: "" },
    { key: "mt5BrokerAccountId", value: "mt5-account-1" },
    { key: "ctraderCode", value: "" },
    { key: "ctraderUserId", value: "2" },
    { key: "ctraderEnv", value: "demo" },
    { key: "ctraderAccountId", value: "1001" },
    { key: "tradeSignalId", value: "1" },
    { key: "dhanTotp", value: "123456" },
    { key: "zebuFactor2", value: "123456" },
  ],
  item: [
    folder("Service", [
      request("Health", "GET", "/health"),
      request("OpenAPI JSON", "GET", "/api/openapi.json"),
      request("Docs HTML", "GET", "/api/docs"),
    ]),
    folder("Auth", [
      request(
        "Login User",
        "POST",
        "/auth/login",
        {
          body: { email: "{{userEmail}}", password: "{{userPassword}}" },
          testScript: saveTokensScript("json.user"),
        }
      ),
      request(
        "Login Admin",
        "POST",
        "/auth/login",
        {
          body: { email: "{{adminEmail}}", password: "{{adminPassword}}" },
          testScript: saveAdminTokensScript("json.user"),
        }
      ),
      request(
        "Refresh",
        "POST",
        "/auth/refresh",
        {
          headers: [{ key: "Cookie", value: "refresh_token={{refreshToken}}" }],
        }
      ),
      request(
        "Google Login",
        "POST",
        "/auth/google",
        { body: { id_token: "{{googleIdToken}}", referralCode: "{{referralCode}}" } }
      ),
      request(
        "Revoke",
        "POST",
        "/auth/revoke",
        {
          headers: [{ key: "Cookie", value: "refresh_token={{refreshToken}}" }],
        }
      ),
      request(
        "Auth Me",
        "GET",
        "/auth/me",
        {
          headers: [{ key: "Cookie", value: "access_token={{userAccessToken}}" }],
        }
      ),
    ]),
    folder("User", [
      request(
        "Register User",
        "POST",
        "/user/register",
        {
          body: {
            email: "{{userEmail}}",
            password: "{{userPassword}}",
            name: "{{userName}}",
            referralCode: "{{referralCode}}",
          },
          testScript: saveTokensScript("json.tokens"),
        }
      ),
      request(
        "Verify Email",
        "GET",
        "/user/verify-email?token={{emailVerificationToken}}"
      ),
      request("Get Me", "GET", "/user/me", { auth: "user" }),
      request("Get Dashboard", "GET", "/user/dashboard", { auth: "user" }),
      request("Get Settings", "GET", "/user/settings", { auth: "user" }),
      request("Get Referral Summary", "GET", "/user/referral", { auth: "user" }),
      request("Get Billing Details", "GET", "/user/billing", { auth: "user" }),
      request(
        "Update Billing Details",
        "PUT",
        "/user/billing",
        {
          auth: "user",
          body: {
            panNumber: "ABCDE1234F",
            accountHolderName: "Example User",
            accountNumber: "123456789012",
            ifscCode: "HDFC0001234",
            bankName: "HDFC Bank",
            branch: "Main Branch",
            addressLine1: "123 Example Street",
            addressLine2: "Near Example Circle",
            city: "Bangalore",
            state: "Karnataka",
            pincode: "560001",
          },
        }
      ),
      request(
        "Update Trade Status",
        "PUT",
        "/user/trade-status",
        { auth: "user", body: { allowTrade: true } }
      ),
      request(
        "Update Copy Trade Status",
        "PUT",
        "/user/copy-trade-status",
        { auth: "user", body: { allowCopyTrade: true } }
      ),
      request("Get Edging Status", "GET", "/user/edging-status", { auth: "user" }),
      request(
        "Update Edging Status",
        "PUT",
        "/user/edging-status",
        { auth: "user", body: { isEnabled: false, notes: "Updated from Postman" } }
      ),
      request(
        "Update Risk Limits",
        "PUT",
        "/user/risk-limits",
        {
          auth: "user",
          body: {
            isEnabled: true,
            dailyLossLimit: 1000,
            dailyProfitTarget: 3000,
            maxTradesPerDay: 8,
            cooldownAfterLossMins: 30,
          },
        }
      ),
    ]),
    folder("Admin User", [
      request("List Users", "GET", "/user?page=1&limit=20&search=", { auth: "admin" }),
      request("Get User Referral", "GET", "/user/{{userId}}/referral", { auth: "admin" }),
      request(
        "Update User Admin Status",
        "PATCH",
        "/user/{{userId}}/admin",
        { auth: "admin", body: { isAdmin: false } }
      ),
      request(
        "Get Admin Strategy Trade Schedule",
        "GET",
        "/user/admin/strategy-trade-schedule",
        { auth: "admin" }
      ),
      request(
        "Update Admin Strategy Trade Schedule",
        "PUT",
        "/user/admin/strategy-trade-schedule",
        {
          auth: "admin",
          body: {
            isEnabled: true,
            timezone: "Asia/Kolkata",
            windows: [
              {
                id: "evening_block",
                label: "US session pause",
                daysOfWeek: [1, 2, 3, 4, 5],
                startTime: "17:00",
                endTime: "19:00",
                isEnabled: true,
              },
            ],
          },
        }
      ),
    ]),
    folder("Plans", [
      request("List Active Plans", "GET", "/admin/plans/subscription-plan/list"),
      request("List All Plans", "GET", "/admin/plans/subscription-plan/all"),
      request("Get Plan", "GET", "/admin/plans/subscription-plan/{{planId}}"),
      request(
        "Create Plan",
        "POST",
        "/admin/plans/subscription-plan",
        {
          auth: "admin",
          body: {
            name: "CRYPTO Ultra",
            description: "Ultra plan for crypto users",
            isActive: true,
            metadata: { tier: "ultra", market: "CRYPTO" },
            planTypeCode: "PREMIUM",
            marketCode: "CRYPTO",
            pricing: {
              priceInr: 2499,
              currency: "INR",
              interval: "monthly",
              isFree: false,
            },
            limits: {
              maxConnectedAccounts: 5,
              maxDailyTrades: 20,
            },
            features: {
              WEBHOOK_EXECUTION: "ENABLED",
              REFERRAL_EARNINGS: "ENABLED",
            },
            strategyId: "{{strategyId}}",
          },
        }
      ),
      request(
        "Update Plan",
        "PATCH",
        "/admin/plans/subscription-plan/{{planId}}",
        {
          auth: "admin",
          body: {
            name: "CRYPTO Basic Updated",
            description: "Updated plan",
            isActive: true,
            pricing: { priceInr: 1099 },
            limits: { maxConnectedAccounts: 3 },
            features: { WEBHOOK_EXECUTION: "ENABLED" },
          },
        }
      ),
      request(
        "Delete Plan",
        "DELETE",
        "/admin/plans/subscription-plan/{{planId}}",
        { auth: "admin" }
      ),
      request(
        "Get Plan Webhook Token",
        "GET",
        "/admin/plans/subscription-plan/{{planId}}/webhook-token",
        { auth: "admin" }
      ),
      request(
        "Rotate Plan Webhook Token",
        "POST",
        "/admin/plans/subscription-plan/{{planId}}/webhook-token/rotate",
        { auth: "admin" }
      ),
    ]),
    folder("Billing", [
      request(
        "Create Checkout",
        "POST",
        "/billing/subscription/checkout",
        { auth: "user", body: { planId: "{{planId}}" } }
      ),
      request(
        "Verify Payment",
        "POST",
        "/billing/subscription/verify",
        {
          auth: "user",
          body: {
            razorpay_order_id: "order_xxxxx",
            razorpay_payment_id: "pay_xxxxx",
            razorpay_signature: "generated_signature",
            invoiceId: 16,
          },
        }
      ),
      request("Get Current Subscription", "GET", "/billing/subscription/current", {
        auth: "user",
      }),
      request(
        "Cancel Current Subscription",
        "POST",
        "/billing/subscription/cancel",
        { auth: "user", body: { immediate: false } }
      ),
      request("Get Wallet", "GET", "/billing/wallet", { auth: "user" }),
      request("List Withdrawals", "GET", "/billing/withdrawals", { auth: "user" }),
      request(
        "Create Withdrawal",
        "POST",
        "/billing/withdrawals",
        { auth: "user", body: { amount: 500 } }
      ),
      request(
        "Razorpay Webhook",
        "POST",
        "/billing/razorpay/webhook",
        {
          headers: [{ key: "x-razorpay-signature", value: "{{razorpaySignature}}" }],
          body: { event: "payment.captured", payload: {} },
        }
      ),
      request(
        "RazorpayX Webhook",
        "POST",
        "/billing/razorpayx/webhook",
        {
          headers: [{ key: "x-razorpay-signature", value: "{{razorpaySignature}}" }],
          body: { event: "payout.processed", payload: {} },
        }
      ),
    ]),
    folder("Admin Billing", [
      request("List Admin Withdrawals", "GET", "/billing/admin/withdrawals", {
        auth: "admin",
      }),
      request(
        "Approve Withdrawal",
        "PATCH",
        "/billing/admin/withdrawals/{{withdrawalId}}/approve",
        { auth: "admin", body: { notes: "Approved by finance admin" } }
      ),
      request(
        "Reject Withdrawal",
        "PATCH",
        "/billing/admin/withdrawals/{{withdrawalId}}/reject",
        { auth: "admin", body: { notes: "Bank details mismatch" } }
      ),
      request(
        "Update Withdrawal Settings",
        "PUT",
        "/billing/admin/withdrawal-settings",
        { auth: "admin", body: { minWithdrawalAmountInr: 500 } }
      ),
    ]),
    folder("Legacy Subscriptions", [
      request(
        "Subscribe Directly",
        "POST",
        "/subscription/subscribe",
        { auth: "user", body: { planId: "{{planId}}" } }
      ),
      request(
        "Cancel Subscription Directly",
        "POST",
        "/subscription/cancel",
        { auth: "user", body: { cancelAtPeriodEnd: false } }
      ),
      request(
        "Get Current Subscription Details",
        "GET",
        "/subscription/current?start=0&count=20",
        { auth: "user" }
      ),
      request(
        "Get Follower Trading Accounts",
        "GET",
        "/subscription/follower-user-trading-account?start=0&count=20",
        { auth: "user" }
      ),
    ]),
    folder("Admin Subscriptions", [
      request(
        "Get User Subscriptions",
        "GET",
        "/admin/subscription/user/{{userId}}",
        { auth: "admin" }
      ),
      request(
        "Get All Subscriptions",
        "GET",
        "/admin/subscription/all?offset=0&limit=20",
        { auth: "admin" }
      ),
      request(
        "Update Subscription Webhook",
        "POST",
        "/admin/subscription/update-webhook",
        {
          auth: "admin",
          body: {
            subscriptionId: "{{subscriptionId}}",
            isWebhookEnabled: true,
          },
        }
      ),
    ]),
    folder("Trading Accounts", [
      request("List Accounts", "GET", "/trading-accounts?planId={{planId}}", {
        auth: "user",
      }),
      request("Get Account", "GET", "/trading-accounts/{{accountId}}", {
        auth: "user",
      }),
      request(
        "Create Account",
        "POST",
        "/trading-accounts",
        {
          auth: "user",
          body: {
            broker: "COINDCX",
            accountLabel: "Main Crypto Account",
            accountId: "my-coindcx-account",
            apiKey: "broker_api_key",
            apiSecret: "broker_api_secret",
            isMaster: true,
            executionFlow: "SELF",
            accountMeta: {
              coindcx: {
                apiKey: "broker_api_key",
                apiSecret: "broker_api_secret",
              },
            },
          },
        }
      ),
      request(
        "Update Account",
        "PATCH",
        "/trading-accounts/{{accountId}}",
        {
          auth: "user",
          body: {
            accountLabel: "Updated Account Label",
            isEnabled: true,
            isMaster: false,
            executionFlow: "SELF",
          },
        }
      ),
      request("Delete Account", "DELETE", "/trading-accounts/{{accountId}}", {
        auth: "user",
      }),
      request(
        "Approve Copy Trading Request",
        "POST",
        "/trading-accounts/allow-copy-trading",
        { auth: "user", body: { requestId: "{{requestId}}", approve: true } }
      ),
      request(
        "List Copy Trading Requests",
        "GET",
        "/trading-accounts/copy-trading-requests",
        { auth: "user" }
      ),
      request(
        "Create Copy Trading Request",
        "POST",
        "/trading-accounts/handle-copy-trading-request",
        {
          auth: "user",
          body: {
            userTradingAccountId: "{{accountId}}",
            userEmail: "master.user@example.com",
          },
        }
      ),
    ]),
    folder("Strategies", [
      request(
        "List Strategies",
        "GET",
        "/strategy?isActive=true&isDeprecated=false&category=forex&chunkSize=20&initialOffset=0",
        { auth: "user" }
      ),
      request("Get Strategy", "GET", "/strategy/{{strategyId}}", { auth: "user" }),
      request(
        "Create Strategy",
        "POST",
        "/strategy",
        {
          auth: "admin",
          body: {
            strategyCode: "EMA_TREND",
            name: "EMA Trend",
            description: "Trend-following EMA strategy",
            category: "forex",
            version: 1,
            defaultParams: { risk: "medium" },
            riskProfile: "medium",
            capitalRequirement: 1000,
            isActive: true,
            isDeprecated: false,
            isCopyable: true,
          },
        }
      ),
      request(
        "Update Strategy",
        "PATCH",
        "/strategy/{{strategyId}}",
        {
          auth: "admin",
          body: {
            version: 2,
            defaultParams: { risk: "low" },
            capitalRequirement: 1500,
          },
        }
      ),
      request("Retire Strategy", "DELETE", "/strategy/{{strategyId}}", {
        auth: "admin",
      }),
      request("Enable Strategy", "PATCH", "/strategy/{{strategyId}}/enable", {
        auth: "user",
      }),
      request("Disable Strategy", "PATCH", "/strategy/{{strategyId}}/disable", {
        auth: "user",
      }),
      request(
        "Enable Strategy Instance",
        "PATCH",
        "/strategy/instance/{{strategyInstanceId}}/enable",
        { auth: "user" }
      ),
      request(
        "Disable Strategy Instance",
        "PATCH",
        "/strategy/instance/{{strategyInstanceId}}/disable",
        { auth: "user" }
      ),
      request(
        "Update Strategy Instance Volume",
        "PATCH",
        "/strategy/instance/{{strategyInstanceId}}/volume",
        { auth: "user", body: { volume: 0.05 } }
      ),
    ]),
    folder("Trades", [
      request(
        "List Active Trades",
        "GET",
        "/trade/all?accountId={{accountId}}&start=0&count=10&status=OPEN",
        { auth: "user" }
      ),
      request("Get One Trade", "GET", "/trade?signalId={{signalId}}", { auth: "user" }),
      request(
        "Get Trade History",
        "GET",
        "/trade/history?accountId={{accountId}}&start=0&count=20&status=CLOSED",
        { auth: "user" }
      ),
      request(
        "Close Trades",
        "POST",
        "/trade/close",
        { auth: "user", body: { signalIds: ["{{signalId}}"], isCloseAll: false } }
      ),
      request(
        "List Trade Alerts",
        "GET",
        "/trade/alerts?start=0&count=20&unreadOnly=false",
        { auth: "user" }
      ),
      request(
        "List Unread Trade Alerts",
        "GET",
        "/trade/alerts?start=0&count=20&unreadOnly=true",
        { auth: "user" }
      ),
      request(
        "Mark Trade Alert Read",
        "PATCH",
        "/trade/alerts/{{tradeAlertId}}/read",
        { auth: "user" }
      ),
      request(
        "Mark All Trade Alerts Read",
        "PATCH",
        "/trade/alerts/read-all",
        { auth: "user" }
      ),
    ]),
    folder("Admin Trades", [
      request(
        "List Strategy Parent Trades",
        "GET",
        "/trade/admin/strategy-trades?strategyId={{strategyId}}&planId={{planId}}&status=blocked&start=0&count=20",
        { auth: "admin" }
      ),
      request(
        "Get Strategy Parent Trade",
        "GET",
        "/trade/admin/strategy-trades/{{adminStrategyTradeId}}",
        { auth: "admin" }
      ),
      request(
        "Close Strategy Parent Trade",
        "POST",
        "/trade/admin/strategy-trades/{{adminStrategyTradeId}}/close",
        { auth: "admin" }
      ),
    ]),
    folder("TradingView Alerts", [
      request(
        "Create Subscriber Alert",
        "POST",
        "/tradingview/alerts",
        { auth: "user", body: alertBody }
      ),
      request(
        "Create Subscriber Alert With Webhook Token",
        "POST",
        "/tradingview/alerts?token={{subscriberWebhookToken}}",
        { body: alertBody }
      ),
      request(
        "Create Strategy Alert",
        "POST",
        "/tradingview/alerts/strategy",
        {
          headers: [{ key: "x-webhook-token", value: "{{planWebhookToken}}" }],
          body: alertBody,
        }
      ),
      request(
        "Alert History",
        "GET",
        "/tradingview/alerts/history?page=1&limit=20&ticker=EURUSD&exchange=FX&interval=15m",
        { auth: "user" }
      ),
    ]),
    folder("Broker Jobs", [
      request(
        "Create Broker Job",
        "POST",
        "/broker/jobs",
        {
          auth: "user",
          body: {
            credentialId: "{{credentialId}}",
            type: "PLACE_ORDER",
            payload: { symbol: "EURUSD", side: "BUY" },
          },
        }
      ),
      request("List Pending Broker Jobs", "GET", "/broker/jobs/pending?limit=50", {
        auth: "admin",
      }),
      request(
        "List Broker Jobs By Credential",
        "GET",
        "/broker/jobs/credential/{{credentialId}}",
        { auth: "user" }
      ),
      request("Get Broker Job", "GET", "/broker/jobs/{{brokerJobId}}", {
        auth: "user",
      }),
      request(
        "Update Broker Job",
        "PATCH",
        "/broker/jobs/{{brokerJobId}}",
        {
          auth: "user",
          body: {
            status: "PENDING",
            attempts: 1,
            payload: { retry: true },
          },
        }
      ),
    ]),
    folder("Support", [
      request(
        "Create Ticket",
        "POST",
        "/support/tickets",
        {
          auth: "user",
          body: {
            subject: "Payment not reflected",
            body: "I completed payment but subscription is still pending.",
          },
        }
      ),
      request("List Tickets", "GET", "/support/tickets", { auth: "user" }),
      request("Get Ticket", "GET", "/support/tickets/{{ticketId}}", { auth: "user" }),
      request(
        "Add Ticket Message",
        "POST",
        "/support/tickets/{{ticketId}}/messages",
        { auth: "user", body: { body: "Attaching more payment details." } }
      ),
    ]),
    folder("CRM Support Integration", [
      request(
        "Upsert Ticket From CRM",
        "POST",
        "/integrations/crm/support/tickets/upsert",
        {
          headers: [{ key: "x-api-secret", value: "{{crmIntegrationSecret}}" }],
          body: {
            crmTicketId: "{{crmTicketId}}",
            platformUserId: "{{userId}}",
            contactEmail: "{{userEmail}}",
            contactName: "{{userName}}",
            subject: "Imported from CRM",
            status: "open",
          },
        }
      ),
      request(
        "Ingest CRM Public Reply",
        "POST",
        "/integrations/crm/support/tickets/{{crmTicketId}}/public-replies",
        {
          headers: [{ key: "x-api-secret", value: "{{crmIntegrationSecret}}" }],
          body: {
            crmMessageId: "CRM-MSG-1001",
            body: "This is a public reply from CRM.",
            repliedBy: { id: "agent-1", name: "Support Agent", email: "agent@example.com" },
          },
        }
      ),
    ]),
    folder("MT5 Signal Listener", [
      request("Poll Signal", "GET", "/signal?userId={{mt5BrokerAccountId}}"),
      request(
        "Acknowledge Signal",
        "POST",
        "/signal/ack",
        {
          body: {
            ackId: "ack-1",
            status: "accepted",
            ticket: "123456",
            orderId: "123456",
          },
        }
      ),
      request(
        "Report EA State",
        "POST",
        "/signal/state?userId={{mt5BrokerAccountId}}",
        {
          body: {
            accountId: "{{mt5BrokerAccountId}}",
            connected: true,
            equity: 1000,
            balance: 1000,
          },
        }
      ),
    ]),
    folder("cTrader Internal", [
      request(
        "OAuth Exchange",
        "POST",
        "/ctrader/oauth/exchange",
        { body: { code: "{{ctraderCode}}", accountId: "{{ctraderAccountId}}" } }
      ),
      request(
        "OAuth Callback",
        "GET",
        "/ctrader/callback?code={{ctraderCode}}&state={{ctraderAccountId}}"
      ),
      request(
        "Get Session",
        "GET",
        "/ctrader/session/{{ctraderUserId}}",
        { headers: [{ key: "x-internal-api-key", value: "{{internalApiKey}}" }] }
      ),
      request(
        "Patch Session",
        "PATCH",
        "/ctrader/session/{{ctraderUserId}}",
        {
          headers: [{ key: "x-internal-api-key", value: "{{internalApiKey}}" }],
          body: {
            patch: {
              env: "{{ctraderEnv}}",
              activeAccountId: "{{ctraderAccountId}}",
              accessTokenEnc: "encrypted-access-token",
              refreshTokenEnc: "encrypted-refresh-token",
            },
            ttlSeconds: 3600,
          },
        }
      ),
      request(
        "Get Symbol Count",
        "GET",
        "/ctrader/symbols/{{ctraderUserId}}/{{ctraderEnv}}/{{ctraderAccountId}}/count",
        { headers: [{ key: "x-internal-api-key", value: "{{internalApiKey}}" }] }
      ),
      request(
        "Get Symbol Id",
        "GET",
        "/ctrader/symbols/{{ctraderUserId}}/{{ctraderEnv}}/{{ctraderAccountId}}/id?symbol=EURUSD",
        { headers: [{ key: "x-internal-api-key", value: "{{internalApiKey}}" }] }
      ),
      request(
        "Get Symbol Meta",
        "GET",
        "/ctrader/symbols/{{ctraderUserId}}/{{ctraderEnv}}/{{ctraderAccountId}}/meta?symbol=EURUSD",
        { headers: [{ key: "x-internal-api-key", value: "{{internalApiKey}}" }] }
      ),
      request(
        "Replace Symbol Cache",
        "PUT",
        "/ctrader/symbols/{{ctraderUserId}}/{{ctraderEnv}}/{{ctraderAccountId}}",
        {
          headers: [{ key: "x-internal-api-key", value: "{{internalApiKey}}" }],
          body: {
            ttlSeconds: 3600,
            items: [
              {
                symbol: "EURUSD",
                symbolId: 1,
                lotSize: "100000",
                digits: 5,
                pipPosition: 4,
              },
            ],
          },
        }
      ),
      request(
        "Search Symbols",
        "GET",
        "/ctrader/symbols/{{ctraderUserId}}/{{ctraderEnv}}/{{ctraderAccountId}}/search?q=EUR&limit=20",
        { headers: [{ key: "x-internal-api-key", value: "{{internalApiKey}}" }] }
      ),
      request(
        "List Active Trailing TP Monitors",
        "GET",
        "/ctrader/trailing-tp-monitors/active",
        { headers: [{ key: "x-internal-api-key", value: "{{internalApiKey}}" }] }
      ),
      request(
        "Get Trailing TP Monitor",
        "GET",
        "/ctrader/trailing-tp-monitors/by-trade-signal/{{tradeSignalId}}",
        { headers: [{ key: "x-internal-api-key", value: "{{internalApiKey}}" }] }
      ),
      request(
        "Upsert Trailing TP Monitor",
        "PUT",
        "/ctrader/trailing-tp-monitors/by-trade-signal/{{tradeSignalId}}",
        {
          headers: [{ key: "x-internal-api-key", value: "{{internalApiKey}}" }],
          body: { monitorStatus: "active", trailingDistance: 10 },
        }
      ),
      request(
        "Patch Trailing TP Monitor",
        "PATCH",
        "/ctrader/trailing-tp-monitors/by-trade-signal/{{tradeSignalId}}",
        {
          headers: [{ key: "x-internal-api-key", value: "{{internalApiKey}}" }],
          body: { monitorStatus: "closing" },
        }
      ),
      request(
        "Mark Trailing TP Monitor Closed",
        "POST",
        "/ctrader/trailing-tp-monitors/{{tradeSignalId}}/mark-closed",
        { headers: [{ key: "x-internal-api-key", value: "{{internalApiKey}}" }] }
      ),
    ]),
    folder("Zebu", [
      request(
        "Save Token",
        "POST",
        "/zebu/auth/token",
        {
          auth: "user",
          body: {
            tradingAccountId: "{{accountId}}",
            accessToken: "paste-zebu-token",
            apiKey: "",
            uid: "",
            actid: "",
          },
        }
      ),
      request(
        "Generate Token",
        "POST",
        "/zebu/auth/token/generate",
        {
          auth: "user",
          body: {
            tradingAccountId: "{{accountId}}",
            password: "broker-password",
            factor2: "{{zebuFactor2}}",
          },
        }
      ),
      request("Get Orders GET", "GET", "/zebu/orders?tradingAccountId={{accountId}}", {
        auth: "user",
      }),
      request(
        "Get Orders POST",
        "POST",
        "/zebu/orders",
        { auth: "user", body: { tradingAccountId: "{{accountId}}" } }
      ),
      request("Get Positions GET", "GET", "/zebu/positions?tradingAccountId={{accountId}}", {
        auth: "user",
      }),
      request(
        "Get Positions POST",
        "POST",
        "/zebu/positions",
        { auth: "user", body: { tradingAccountId: "{{accountId}}" } }
      ),
      request("Get Holdings GET", "GET", "/zebu/holdings?tradingAccountId={{accountId}}", {
        auth: "user",
      }),
      request(
        "Get Holdings POST",
        "POST",
        "/zebu/holdings",
        { auth: "user", body: { tradingAccountId: "{{accountId}}" } }
      ),
      request("Place Order", "POST", "/zebu/orders/place", {
        auth: "user",
        body: orderBody,
      }),
      request(
        "Modify Order",
        "POST",
        "/zebu/orders/modify",
        {
          auth: "user",
          body: {
            tradingAccountId: "{{accountId}}",
            orderId: "order-1",
            quantity: 2,
            price: 100,
          },
        }
      ),
      request(
        "Cancel Order",
        "POST",
        "/zebu/orders/cancel",
        { auth: "user", body: { tradingAccountId: "{{accountId}}", orderId: "order-1" } }
      ),
      request(
        "Execute Pending",
        "POST",
        "/zebu/execute-pending",
        { auth: "admin", body: { batchSize: 20 } }
      ),
    ]),
    folder("Dhan", [
      request(
        "Save Token",
        "POST",
        "/dhan/auth/token",
        {
          auth: "user",
          body: {
            tradingAccountId: "{{accountId}}",
            accessToken: "paste-dhan-token",
            apiKey: "",
          },
        }
      ),
      request(
        "Generate Token",
        "POST",
        "/dhan/auth/token/generate",
        {
          auth: "user",
          body: {
            tradingAccountId: "{{accountId}}",
            totp: "{{dhanTotp}}",
          },
        }
      ),
      request("Place Order", "POST", "/dhan/orders/place", { auth: "user", body: orderBody }),
      request(
        "Modify Order",
        "POST",
        "/dhan/orders/modify",
        {
          auth: "user",
          body: {
            tradingAccountId: "{{accountId}}",
            orderId: "order-1",
            quantity: 2,
            price: 100,
          },
        }
      ),
      request(
        "Cancel Order",
        "POST",
        "/dhan/orders/cancel",
        { auth: "user", body: { tradingAccountId: "{{accountId}}", orderId: "order-1" } }
      ),
      request("Get Orders", "POST", "/dhan/orders", {
        auth: "user",
        body: { tradingAccountId: "{{accountId}}" },
      }),
      request("Get Positions", "POST", "/dhan/positions", {
        auth: "user",
        body: { tradingAccountId: "{{accountId}}" },
      }),
      request("Get Holdings", "POST", "/dhan/holdings", {
        auth: "user",
        body: { tradingAccountId: "{{accountId}}" },
      }),
      request("Execute Pending", "POST", "/dhan/execute-pending", {
        auth: "user",
        body: { batchSize: 20 },
      }),
    ]),
    folder("CoinDCX", [
      request("Public Ticker", "GET", "/coindcx/public/ticker?market=BTCINR"),
      request("Public Orderbook", "GET", "/coindcx/public/orderbook?market=BTCINR"),
      request("Place Order", "POST", "/coindcx/orders/place", {
        auth: "user",
        body: coinDcxOrderBody,
      }),
      request(
        "Modify Order",
        "POST",
        "/coindcx/orders/modify",
        {
          auth: "user",
          body: {
            tradingAccountId: "{{accountId}}",
            orderId: "order-1",
            quantity: 0.002,
            price: 5000000,
          },
        }
      ),
      request(
        "Cancel Order",
        "POST",
        "/coindcx/orders/cancel",
        { auth: "user", body: { tradingAccountId: "{{accountId}}", orderId: "order-1" } }
      ),
      request("Get Orders", "POST", "/coindcx/orders", {
        auth: "user",
        body: { tradingAccountId: "{{accountId}}" },
      }),
      request("Get Positions", "POST", "/coindcx/positions", {
        auth: "user",
        body: { tradingAccountId: "{{accountId}}" },
      }),
      request("Get Holdings", "POST", "/coindcx/holdings", {
        auth: "user",
        body: { tradingAccountId: "{{accountId}}" },
      }),
      request("Execute Pending", "POST", "/coindcx/execute-pending", {
        auth: "user",
        body: { batchSize: 20 },
      }),
    ]),
  ],
};

fs.writeFileSync(outputPath, `${JSON.stringify(collection, null, 2)}\n`, "utf8");
console.log(`Wrote ${outputPath}`);
