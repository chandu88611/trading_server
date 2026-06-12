export function getTradingOpenApi() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Trading Service API',
      version: '1.0.0',
      description:
        'Trading-owned billing API plus CRM lifecycle sync contract. The trading service is the only writer for plans, subscriptions, invoices, and payments.',
    },
    paths: {
      '/api/openapi.json': {
        get: {
          summary: 'Get OpenAPI document',
          responses: { '200': { description: 'OpenAPI JSON' } },
        },
      },
      '/api/docs': {
        get: {
          summary: 'Get API documentation page',
          responses: { '200': { description: 'Documentation HTML' } },
        },
      },
      '/zebu/auth/token/generate': {
        post: {
          summary: 'Generate and save a Zebu session token',
          description:
            'Runs MYNT/Noren QuickAuth with password plus `factor2`; `totp` is accepted as a backward-compatible alias.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['tradingAccountId', 'password', 'factor2'],
                  properties: {
                    tradingAccountId: { type: 'integer' },
                    password: { type: 'string' },
                    factor2: { type: 'string' },
                    totp: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Zebu token generated and stored' } },
        },
      },
      '/zebu/auth/token': {
        post: {
          summary: 'Save a pasted Zebu session token',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['tradingAccountId', 'accessToken'],
                  properties: {
                    tradingAccountId: { type: 'integer' },
                    accessToken: { type: 'string' },
                    uid: { type: 'string' },
                    actid: { type: 'string' },
                    baseUrl: { type: 'string', example: 'https://go.mynt.in/NorenWClientTP' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Zebu token saved' } },
        },
      },
      '/zebu/orders': {
        get: {
          summary: 'Get Zebu order book',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'tradingAccountId', in: 'query', required: true, schema: { type: 'integer' } }],
          responses: { '200': { description: 'Zebu orders fetched' } },
        },
        post: {
          summary: 'Get Zebu order book',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Zebu orders fetched' } },
        },
      },
      '/zebu/positions': {
        get: {
          summary: 'Get Zebu positions',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'tradingAccountId', in: 'query', required: true, schema: { type: 'integer' } }],
          responses: { '200': { description: 'Zebu positions fetched' } },
        },
        post: {
          summary: 'Get Zebu positions',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Zebu positions fetched' } },
        },
      },
      '/zebu/holdings': {
        get: {
          summary: 'Get Zebu holdings',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'tradingAccountId', in: 'query', required: true, schema: { type: 'integer' } }],
          responses: { '200': { description: 'Zebu holdings fetched' } },
        },
        post: {
          summary: 'Get Zebu holdings',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Zebu holdings fetched' } },
        },
      },
      '/zebu/orders/place': {
        post: {
          summary: 'Place a Zebu order',
          description: 'Supports MARKET, LIMIT, SL-LMT, and SL-MKT order types.',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Zebu order placed' } },
        },
      },
      '/zebu/orders/modify': {
        post: {
          summary: 'Modify a Zebu order',
          description:
            'Accepts symbol, exchange, and orderType when supplied; otherwise missing fields are resolved from the Zebu order book.',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Zebu order modified' } },
        },
      },
      '/zebu/orders/cancel': {
        post: {
          summary: 'Cancel a Zebu order',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Zebu order cancelled' } },
        },
      },
      '/user/register': {
        post: {
          summary: 'Register a trading user',
          description:
            'Creates a platform user, accepts an optional `referralCode` for first-time signup, and enqueues a `user.registered` lifecycle event for CRM when the account is new.',
          responses: { '200': { description: 'User registered' } },
        },
      },
      '/user/referral': {
        get: {
          summary: 'Get the current user referral summary',
          description:
            'Returns the caller referral code, 2-level upline, counts, and full 2-level downline with masked emails.',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Referral summary fetched' } },
        },
      },
      '/user/{userId}/referral': {
        get: {
          summary: 'Get a user referral summary (admin)',
          description:
            'Admin-only endpoint. Returns the target user referral code, 2-level upline, counts, and full 2-level downline with full emails.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'userId',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
          responses: { '200': { description: 'Referral summary fetched' } },
        },
      },
      '/user/settings': {
        get: {
          summary: 'Get grouped user settings for the settings page',
          description:
            'Returns the caller global trade flag, copy-trade flag, edging state, risk limits, referral-earnings wallet summary, and all user-owned trading accounts with broker and subscription summaries.',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Settings fetched successfully' } },
        },
      },
      '/user/admin/strategy-trade-schedule': {
        get: {
          summary: 'Get the admin strategy trade schedule',
          description:
            'Admin-only endpoint. Returns the current timezone-aware blocked execution windows used to suppress admin strategy trade fanout.',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Admin strategy trade schedule fetched' } },
        },
        put: {
          summary: 'Update the admin strategy trade schedule',
          description:
            'Admin-only endpoint. Replaces the timezone-aware blocked execution windows used to suppress admin strategy trade fanout while still storing incoming strategy snapshots.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['isEnabled', 'timezone', 'windows'],
                  properties: {
                    isEnabled: { type: 'boolean' },
                    timezone: { type: 'string', example: 'Asia/Kolkata' },
                    windows: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: ['daysOfWeek', 'startTime', 'endTime', 'isEnabled'],
                        properties: {
                          id: { type: 'string', example: 'evening_block' },
                          label: { type: 'string', nullable: true, example: 'US session pause' },
                          daysOfWeek: {
                            type: 'array',
                            items: { type: 'integer', minimum: 0, maximum: 6 },
                            example: [1, 2, 3, 4, 5],
                          },
                          startTime: { type: 'string', example: '17:00' },
                          endTime: { type: 'string', example: '19:00' },
                          isEnabled: { type: 'boolean' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Admin strategy trade schedule updated' } },
        },
      },
      '/strategy': {
        get: {
          summary: 'List strategies',
          description:
            'Authenticated users see active, non-deprecated strategies. Admins can list all strategies and filter by `isActive`, `isDeprecated`, `category`, `searchParam`, `chunkSize`, and `initialOffset`.',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Fetched strategies' } },
        },
        post: {
          summary: 'Create a strategy',
          description:
            'Admin-only catalog create. New strategy definitions are used for new subscriptions; existing user strategy instances keep their frozen params/version.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StrategyWrite' },
              },
            },
          },
          responses: { '201': { description: 'Strategy created' } },
        },
      },
      '/strategy/{strategyId}': {
        get: {
          summary: 'Get a strategy',
          description:
            'Users can fetch only active, non-deprecated strategies. Admins can fetch any strategy catalog row.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'strategyId', in: 'path', required: true, schema: { type: 'integer' } },
          ],
          responses: { '200': { description: 'Fetched strategy' } },
        },
        patch: {
          summary: 'Update a strategy',
          description:
            'Admin-only partial catalog update. Existing user strategy instances are not rewritten.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'strategyId', in: 'path', required: true, schema: { type: 'integer' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StrategyWrite' },
              },
            },
          },
          responses: { '200': { description: 'Strategy updated' } },
        },
        delete: {
          summary: 'Soft retire a strategy',
          description:
            'Admin-only soft delete. Sets `isActive=false` and `isDeprecated=true`; does not delete plans or existing user strategy instances.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'strategyId', in: 'path', required: true, schema: { type: 'integer' } },
          ],
          responses: { '200': { description: 'Strategy retired' } },
        },
      },
      '/strategy/{strategyId}/enable': {
        patch: {
          summary: 'Enable a strategy or user strategy instance by strategy id',
          description:
            'Admin callers enable catalog availability for new subscriptions. User callers enable their own active strategy instance for the strategy id.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'strategyId', in: 'path', required: true, schema: { type: 'integer' } },
          ],
          responses: { '200': { description: 'Strategy enabled' } },
        },
      },
      '/strategy/{strategyId}/disable': {
        patch: {
          summary: 'Disable a strategy or user strategy instance by strategy id',
          description:
            'Admin callers disable catalog availability for new subscriptions. User callers pause their own active strategy instance for the strategy id.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'strategyId', in: 'path', required: true, schema: { type: 'integer' } },
          ],
          responses: { '200': { description: 'Strategy disabled' } },
        },
      },
      '/user/trade-status': {
        put: {
          summary: 'Update the global trading pause flag',
          description:
            'Updates the caller `allowTrade` user flag and bulk-enables or bulk-disables every trading account owned by that user in the same write flow.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['allowTrade'],
                  properties: {
                    allowTrade: { type: 'boolean' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Trade status updated' } },
        },
      },
      '/user/risk-limits': {
        put: {
          summary: 'Update user risk-limit settings',
          description:
            'Stores settings-page risk controls such as enable/disable, daily loss limit, daily profit target, max trades per day, and cooldown after loss in minutes.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['isEnabled'],
                  properties: {
                    isEnabled: { type: 'boolean' },
                    dailyLossLimit: { type: 'number', nullable: true },
                    dailyProfitTarget: { type: 'number', nullable: true },
                    maxTradesPerDay: { type: 'integer', nullable: true },
                    cooldownAfterLossMins: { type: 'integer', nullable: true },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Risk limits updated' } },
        },
      },
      '/auth/google': {
        post: {
          summary: 'Authenticate with Google',
          description:
            'Creates a trading user on first sign-in, accepts an optional `referralCode`, and enqueues a `user.registered` lifecycle event for CRM.',
          responses: { '200': { description: 'Authentication result' } },
        },
      },
      '/billing/subscription/checkout': {
        post: {
          summary: 'Create subscription checkout',
          description:
            'Starts a trading-owned checkout flow for plan purchase, stores a local pending invoice plus Razorpay order row, and returns the Razorpay order id with the amount in the smallest currency subunit.',
          responses: { '200': { description: 'Checkout created' } },
        },
      },
      '/billing/subscription/verify': {
        post: {
          summary: 'Verify payment and activate subscription',
          description:
            'Marks a trading invoice paid idempotently, activates or renews the subscription, and enqueues CRM `invoice.upserted` plus subscription lifecycle events only on the first paid transition.',
          responses: { '200': { description: 'Payment verified' } },
        },
      },
      '/billing/subscription/cancel': {
        post: {
          summary: 'Cancel subscription',
          description:
            'Cancels a trading subscription and enqueues a CRM lifecycle event so renewal follow-up can begin in CRM.',
          responses: { '200': { description: 'Subscription canceled' } },
        },
      },
      '/billing/wallet': {
        get: {
          summary: 'Get referral earnings wallet summary',
          description:
            'Returns live referral wallet totals for the authenticated user, including total earned, pending rewards, withdrawable balance, locked withdrawals, total withdrawn, minimum withdrawal amount, and reward hold days.',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Wallet fetched successfully' } },
        },
      },
      '/billing/withdrawals': {
        get: {
          summary: 'List withdrawal requests',
          description:
            'Returns the authenticated user withdrawal request history for referral earnings payouts.',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Withdrawals fetched successfully' } },
        },
        post: {
          summary: 'Create a withdrawal request',
          description:
            'Creates a referral-earnings withdrawal request after validating billing details, minimum withdrawal amount, and current withdrawable balance.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['amount'],
                  properties: {
                    amount: { type: 'number' },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'Withdrawal requested' } },
        },
      },
      '/billing/admin/withdrawals': {
        get: {
          summary: 'List withdrawal requests for admin review',
          description:
            'Admin-only endpoint. Returns all withdrawal requests with requester identity and payout status details.',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Admin withdrawals fetched successfully' } },
        },
      },
      '/billing/admin/withdrawals/{withdrawalId}/approve': {
        patch: {
          summary: 'Approve a withdrawal request',
          description:
            'Admin-only endpoint. Creates or reuses the RazorpayX contact and fund account, creates the payout with idempotency, and updates local withdrawal state.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'withdrawalId',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
          responses: { '200': { description: 'Withdrawal approved' } },
        },
      },
      '/billing/admin/withdrawals/{withdrawalId}/reject': {
        patch: {
          summary: 'Reject a withdrawal request',
          description:
            'Admin-only endpoint. Rejects a withdrawal request and releases the locked funds back into the user withdrawable balance.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'withdrawalId',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
          responses: { '200': { description: 'Withdrawal rejected' } },
        },
      },
      '/billing/admin/withdrawal-settings': {
        put: {
          summary: 'Update global withdrawal settings',
          description:
            'Admin-only endpoint. Updates the global minimum withdrawal amount override used for referral-earnings payouts.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['minWithdrawalAmountInr'],
                  properties: {
                    minWithdrawalAmountInr: { type: 'number' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Withdrawal settings updated' } },
        },
      },
      '/billing/razorpay/webhook': {
        post: {
          summary: 'Handle Razorpay payment webhooks',
          description:
            'Internal webhook endpoint that verifies the raw-body signature and idempotently handles `payment.captured`, `payment.failed`, and `order.paid` events.',
          responses: { '200': { description: 'Webhook received' } },
        },
      },
      '/billing/razorpayx/webhook': {
        post: {
          summary: 'Handle RazorpayX payout webhooks',
          description:
            'Internal webhook endpoint that verifies the raw-body signature and updates withdrawal payout state for events such as `payout.queued`, `payout.processed`, `payout.failed`, `payout.rejected`, and `payout.reversed`.',
          responses: { '200': { description: 'Webhook received' } },
        },
      },
      '/admin/plans/subscription-plan/{planId}/webhook-token': {
        get: {
          summary: 'Fetch plan webhook token for strategy-managed alerts',
          description:
            'Admin-only endpoint. Returns the plan-level webhook token used by TradingView or admin automation to post to `/tradingview/alerts/strategy` for fanout across all active subscribers of that strategy-managed plan.',
          parameters: [
            {
              name: 'planId',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
          responses: { '200': { description: 'Plan webhook token fetched' } },
        },
      },
      '/trade/alerts': {
        get: {
          summary: 'List subscriber trade alerts',
          description:
            'Returns persisted subscriber-facing alerts created whenever a new BUY or SELL trade signal is placed for the authenticated user. `unreadOnly=true` filters to unread alerts.',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Trade alerts fetched' } },
        },
      },
      '/trade/alerts/{alertId}/read': {
        patch: {
          summary: 'Mark one subscriber trade alert as read',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'alertId',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
          responses: { '200': { description: 'Trade alert marked read' } },
        },
      },
      '/trade/alerts/read-all': {
        patch: {
          summary: 'Mark all subscriber trade alerts as read',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Trade alerts marked read' } },
        },
      },
      '/tradingview/alerts': {
        post: {
          summary: 'Create subscriber-scoped alert snapshot',
          description:
            'Accepts a subscriber webhook token or access token. Use this route for non-strategy plans only. Strategy-managed plans are rejected and must use `/tradingview/alerts/strategy` with the admin plan webhook token.',
          security: [{ bearerAuth: [] }],
          responses: { '201': { description: 'Alert snapshot created' } },
        },
      },
      '/tradingview/alerts/strategy': {
        post: {
          summary: 'Create strategy-managed alert snapshot',
          description:
            'Accepts the admin plan webhook token and fans out one strategy-managed TradingView alert to all active subscribers of that plan. The token may be supplied via `x-webhook-token`, `Authorization: Bearer <token>`, query `token`, or body `token`/`webhook_token`.',
          security: [{ bearerAuth: [] }],
          responses: { '201': { description: 'Strategy-managed alert fanout created' } },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
        },
      },
      schemas: {
        StrategyWrite: {
          type: 'object',
          properties: {
            strategyCode: { type: 'string', example: 'EMA_TREND' },
            name: { type: 'string', example: 'EMA Trend' },
            description: { type: 'string', nullable: true },
            category: { type: 'string', example: 'forex' },
            version: { type: 'integer', minimum: 1, default: 1 },
            defaultParams: { type: 'object', additionalProperties: true },
            riskProfile: { type: 'string', nullable: true },
            capitalRequirement: { type: 'number', nullable: true },
            isActive: { type: 'boolean', default: true },
            isDeprecated: { type: 'boolean', default: false },
            isCopyable: { type: 'boolean', default: true },
          },
        },
        CrmLifecycleEnvelope: {
          type: 'object',
          required: ['eventId', 'eventType', 'occurredAt', 'source', 'user', 'leadMatchKeys'],
          properties: {
            eventId: { type: 'string', description: 'Idempotency key for CRM ingestion.' },
            eventType: {
              type: 'string',
              enum: [
                'user.registered',
                'subscription.activated',
                'subscription.updated',
                'subscription.canceled',
                'subscription.expired',
                'subscription.renewed',
                'invoice.upserted',
                'payment.failed',
              ],
            },
            occurredAt: { type: 'string', format: 'date-time' },
            organizationId: { type: 'string', nullable: true },
            source: { type: 'string', example: 'trading_service' },
            user: { $ref: '#/components/schemas/CrmLifecycleUser' },
            leadMatchKeys: { $ref: '#/components/schemas/CrmLifecycleMatchKeys' },
            subscription: {
              allOf: [{ $ref: '#/components/schemas/CrmLifecycleSubscription' }],
              nullable: true,
            },
            invoice: {
              allOf: [{ $ref: '#/components/schemas/CrmLifecycleInvoice' }],
              nullable: true,
            },
            billingDetails: {
              type: 'object',
              nullable: true,
              properties: {
                addressLine1: { type: 'string', nullable: true },
                city: { type: 'string', nullable: true },
                state: { type: 'string', nullable: true },
                pincode: { type: 'string', nullable: true },
              },
            },
          },
        },
        CrmLifecycleUser: {
          type: 'object',
          required: ['platformUserId', 'email'],
          properties: {
            platformUserId: { type: 'string' },
            name: { type: 'string', nullable: true },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string', nullable: true },
          },
        },
        CrmLifecycleMatchKeys: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            phone: { type: 'string', nullable: true },
          },
        },
        CrmLifecycleSubscription: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string' },
            planId: { type: 'string' },
            planName: { type: 'string', nullable: true },
            status: { type: 'string' },
            startDate: { type: 'string', format: 'date-time', nullable: true },
            endDate: { type: 'string', format: 'date-time', nullable: true },
            autoRenew: { type: 'boolean' },
            executionEnabled: { type: 'boolean' },
          },
        },
        CrmLifecycleInvoice: {
          type: 'object',
          properties: {
            tradeInvoiceId: { type: 'string' },
            subscriptionId: { type: 'string', nullable: true },
            planId: { type: 'string' },
            planName: { type: 'string', nullable: true },
            amountCents: { type: 'integer' },
            currency: { type: 'string', example: 'INR' },
            paymentStatus: { type: 'string' },
            paymentMethod: { type: 'string', nullable: true },
            transactionReference: { type: 'string', nullable: true },
            invoiceDate: { type: 'string', format: 'date-time', nullable: true },
          },
        },
      },
    },
  };
}
