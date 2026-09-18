-- Safe, repeatable migration for emergency-halt account status.
-- Supports both the current trading_account_status enum and the legacy
-- user_trading_accounts_status_enum name used by older deployments.
DO $$
DECLARE
  enum_schema TEXT;
  enum_name TEXT;
BEGIN
  FOR enum_schema, enum_name IN
    SELECT n.nspname, t.typname
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE t.typtype = 'e'
       AND t.typname IN ('trading_account_status', 'user_trading_accounts_status_enum')
  LOOP
    EXECUTE format(
      'ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L',
      enum_schema,
      enum_name,
      'halted'
    );
  END LOOP;
END $$;

-- New installations must include the value in their initial CREATE TYPE:
-- CREATE TYPE trading_account_status AS ENUM ('pending', 'verified', 'blocked', 'halted');
