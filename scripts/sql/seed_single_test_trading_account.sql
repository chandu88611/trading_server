-- Purpose: Seed one controlled test user + trading account for broker-flow testing.
-- Safe usage: run in staging/test DB first. Review IDs before executing in production-like environments.

BEGIN;

-- 1) Ensure broker rows exist (id auto-generated if absent)
INSERT INTO brokers (code, name, market_category, is_active)
VALUES
  ('CT', 'CTrader', 'FOREX', true),
  ('MT5', 'MT5', 'FOREX', true),
  ('DHAN', 'Dhan', 'INDIA', true),
  ('ZEBU', 'Zebu', 'INDIA', true)
ON CONFLICT (code) DO NOTHING;

-- 2) Ensure one test user exists (replace email/phone if unique constraints differ)
INSERT INTO users (
  full_name,
  email,
  phone,
  password_hash,
  role,
  is_email_verified,
  is_phone_verified,
  created_at,
  updated_at
)
SELECT
  'Broker Test User',
  'broker.test.user+20260228@example.com',
  '+910000000001',
  'seeded_placeholder_hash',
  'USER',
  true,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = 'broker.test.user+20260228@example.com'
);

-- 3) Upsert one trading account per target broker for same user
WITH u AS (
  SELECT id AS user_id
  FROM users
  WHERE email = 'broker.test.user+20260228@example.com'
  LIMIT 1
), b AS (
  SELECT id, code FROM brokers WHERE code IN ('CT', 'MT5', 'DHAN', 'ZEBU')
)
INSERT INTO user_trading_accounts (
  user_id,
  subscription_id,
  is_master,
  broker_id,
  account_id,
  execution_flow,
  account_label,
  account_meta,
  credentials_encrypted,
  status,
  last_verified_at,
  access_token,
  refresh_token,
  created_at,
  updated_at
)
SELECT
  u.user_id,
  NULL,
  false,
  b.id,
  CASE b.code
    WHEN 'CT' THEN 'CT-TEST-001'
    WHEN 'MT5' THEN 'MT5-TEST-001'
    WHEN 'DHAN' THEN 'DHAN-TEST-001'
    WHEN 'ZEBU' THEN 'ZEBU-TEST-001'
  END,
  'API',
  b.code || ' Test Account',
  CASE b.code
    WHEN 'CT' THEN jsonb_build_object('ctraderAccountId', '46021074')
    WHEN 'DHAN' THEN jsonb_build_object('dhan', jsonb_build_object('baseUrl', 'https://dhan.mock', 'clientId', 'cid', 'apiKey', 'key', 'apiSecret', 'secret'))
    WHEN 'ZEBU' THEN jsonb_build_object('zebu', jsonb_build_object('baseUrl', 'https://zebu.mock', 'clientId', 'cid', 'apiKey', 'key', 'apiSecret', 'secret'))
    ELSE '{}'::jsonb
  END,
  'seeded_credentials',
  'pending',
  NULL,
  'seed_access_token',
  'seed_refresh_token',
  NOW(),
  NOW()
FROM u
JOIN b ON true
WHERE NOT EXISTS (
  SELECT 1
  FROM user_trading_accounts uta
  WHERE uta.user_id = u.user_id
    AND uta.broker_id = b.id
    AND uta.account_id = CASE b.code
      WHEN 'CT' THEN 'CT-TEST-001'
      WHEN 'MT5' THEN 'MT5-TEST-001'
      WHEN 'DHAN' THEN 'DHAN-TEST-001'
      WHEN 'ZEBU' THEN 'ZEBU-TEST-001'
    END
);

COMMIT;

-- Verification query
-- SELECT uta.id, u.email, b.code, uta.account_id, uta.status
-- FROM user_trading_accounts uta
-- JOIN users u ON u.id = uta.user_id
-- JOIN brokers b ON b.id = uta.broker_id
-- WHERE u.email = 'broker.test.user+20260228@example.com'
-- ORDER BY b.code;
