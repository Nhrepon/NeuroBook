-- 0001_initial/up.sql
-- Core schema + RLS policies (R9) + immutability trigger (R1) + balance
-- trigger (R4). This is the non-superuser role's contract.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE account_type AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
CREATE TYPE voucher_status AS ENUM ('draft', 'posted', 'reversed');
CREATE TYPE voucher_type AS ENUM (
  'PAYMENT', 'RECEIPT', 'JOURNAL',
  'SALES_INVOICE', 'PURCHASE_INVOICE',
  'DEBIT_NOTE', 'CREDIT_NOTE',
  'CONTRA', 'REFUND', 'TRANSFER', 'STOCK_TRANSFER', 'ADJUSTMENT'
);
CREATE TYPE fiscal_period_status AS ENUM ('open', 'closed');
CREATE TYPE party_type AS ENUM ('CUSTOMER', 'SUPPLIER', 'BOTH');

-- Tenants
CREATE TABLE tenants (
  id                  text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name                text NOT NULL,
  bin                 varchar(32),
  tin                 varchar(32),
  address             text,
  division            text,
  district            text,
  upazila             text,
union_u             text,
  rounding_account_id text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Fiscal periods (R2)
CREATE TABLE fiscal_periods (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  label           text NOT NULL,
  start_date      timestamptz NOT NULL,
  end_date        timestamptz NOT NULL,
  status          fiscal_period_status NOT NULL DEFAULT 'open',
  closed_by       text,
  closed_at       timestamptz,
  reopened_by     text,
  reopened_at     timestamptz
);
CREATE UNIQUE INDEX fiscal_periods_tenant_label_uq ON fiscal_periods (tenant_id, label);

-- Voucher sequences (R3)
CREATE TABLE voucher_sequences (
  tenant_id        text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  voucher_type     text NOT NULL,
  fiscal_year_label text NOT NULL,
  last_number      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, voucher_type, fiscal_year_label)
);

-- Accounts
CREATE TABLE accounts (
  id                    text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id             text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  code                  varchar(50) NOT NULL,
  type                  account_type NOT NULL,
  parent_id             text,
  is_group              boolean NOT NULL DEFAULT false,
  opening_balance       integer NOT NULL DEFAULT 0,
  tax_applicable        boolean NOT NULL DEFAULT false,
  tax_category          text,
  tax_rate              numeric(5,2),
  tax_exempt            boolean DEFAULT false,
  tax_deductible        boolean DEFAULT false,
  tax_deductible_rate   numeric(5,2),
  tax_exempt_rate       numeric(5,2),
  tax_exempt_reason     text,
  tax_deductible_reason text,
  active                boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX accounts_tenant_code_uq ON accounts (tenant_id, code);
CREATE INDEX accounts_tenant_type_idx ON accounts (tenant_id, type);

-- Vouchers
CREATE TABLE vouchers (
  id                 text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id          text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  voucher_type       voucher_type NOT NULL,
  date               timestamptz NOT NULL,
  narration          text NOT NULL,
  status             voucher_status NOT NULL DEFAULT 'draft',
  total_debit        integer NOT NULL DEFAULT 0,
  total_credit       integer NOT NULL DEFAULT 0,
  sequence_number    varchar(50),
  fiscal_period_label text,
  reversed_by_id     text,
  reverses_id        text,
  idempotency_key    varchar(64),
  version            integer NOT NULL DEFAULT 1,
  created_by         text NOT NULL,
  posted_by          text,
  posted_at          timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vouchers_tenant_date_idx ON vouchers (tenant_id, date);
CREATE INDEX vouchers_tenant_status_idx ON vouchers (tenant_id, status);
CREATE INDEX vouchers_tenant_sequence_idx ON vouchers (tenant_id, sequence_number);
CREATE UNIQUE INDEX vouchers_tenant_idem_uq ON vouchers (tenant_id, idempotency_key);

-- Journal lines
CREATE TABLE journal_lines (
  id           text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id    text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  voucher_id   text NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  account_id   text NOT NULL REFERENCES accounts(id),
  account_type account_type NOT NULL,
  debit        integer NOT NULL DEFAULT 0,
  credit       integer NOT NULL DEFAULT 0,
  reference    text,
  line_order   integer NOT NULL DEFAULT 0
);
CREATE INDEX journal_lines_voucher_idx ON journal_lines (tenant_id, voucher_id);
CREATE INDEX journal_lines_account_idx ON journal_lines (tenant_id, account_id);

-- Idempotency cache (R6)
CREATE TABLE idempotency_keys (
  tenant_id     text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key           varchar(64) NOT NULL,
  voucher_id    text REFERENCES vouchers(id),
  response_json text NOT NULL,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, key)
);

-- Parties
CREATE TABLE parties (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type            party_type NOT NULL,
  name            text NOT NULL,
  contact_person  text,
  phone           varchar(32),
  email           varchar(200),
  bin             varchar(32),
  tin             varchar(32),
  address         text,
  division        text,
  district        text,
  upazila         text,
union_u           text,
  opening_balance text NOT NULL DEFAULT '0',
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX parties_tenant_idx ON parties (tenant_id);

-- Products
CREATE TABLE products (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id  text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       text NOT NULL,
  sku        varchar(64),
  unit       varchar(16),
  hsn_code   varchar(32),
  vat_rate   text NOT NULL DEFAULT '15',
  sd_rate    text NOT NULL DEFAULT '0',
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_tenant_sku_idx ON products (tenant_id, sku);

-- Users (R11/R12)
CREATE TABLE users (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id      text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email          varchar(200) NOT NULL,
  password_hash  text NOT NULL,
  totp_secret    text,
  totp_enabled   boolean NOT NULL DEFAULT false,
  full_name      text,
  role           text NOT NULL DEFAULT 'USER',
  active         boolean NOT NULL DEFAULT true,
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_tenant_email_uq ON users (tenant_id, email);

-- Sessions (R13)
CREATE TABLE sessions (
  id                 text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id          text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id            text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL,
  user_agent         text,
  ip                 varchar(64),
  expires_at         timestamptz NOT NULL,
  revoked_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- Audit log (R15)
CREATE TABLE audit_log (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id     text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       text,
  ip            varchar(64),
  action        text NOT NULL,
  resource_type text NOT NULL,
  resource_id   text,
  before        jsonb,
  after         jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_tenant_created_idx ON audit_log (tenant_id, created_at);
CREATE INDEX audit_log_resource_idx ON audit_log (tenant_id, resource_type, resource_id);

-- ---------------------------------------------------------------------------
-- RLS (R9): every tenant-scoped table has a policy keyed on the
-- `neurobook.tenant_id` session GUC. The application sets the GUC after
-- JWT verification; the DB rejects anything else.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION neurobook_current_tenant() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT current_setting('neurobook.tenant_id', true)
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'accounts', 'vouchers', 'journal_lines', 'parties', 'products',
    'users', 'sessions', 'audit_log', 'fiscal_periods', 'voucher_sequences',
    'idempotency_keys'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = neurobook_current_tenant())',
      t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- R1: posted vouchers are immutable. The trigger permits exactly one write
-- on a posted row: the transition to 'reversed' made by the reversal flow.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_voucher_immutability() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'posted' THEN
    -- Allow the single transition to 'reversed'.
    IF NEW.status = 'reversed' AND OLD.status <> NEW.status THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'IMMUTABLE: posted vouchers cannot be modified (id=%)', OLD.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER voucher_immutability
  BEFORE UPDATE ON vouchers
  FOR EACH ROW EXECUTE FUNCTION enforce_voucher_immutability();

CREATE OR REPLACE FUNCTION enforce_voucher_no_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('posted', 'reversed') THEN
    RAISE EXCEPTION 'IMMUTABLE: posted/reversed vouchers cannot be deleted (id=%)', OLD.id;
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER voucher_no_delete
  BEFORE DELETE ON vouchers
  FOR EACH ROW EXECUTE FUNCTION enforce_voucher_no_delete();

-- ---------------------------------------------------------------------------
-- R4: balance check at post. Recompute Σdebit/Σcredit from the lines and
-- compare to the stored header totals. A CHECK on the voucher row alone
-- proves nothing about the entries.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_voucher_balance() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  sum_d integer;
  sum_c integer;
  cnt integer;
BEGIN
  IF NEW.status = 'posted' THEN
    SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0), COUNT(*)
      INTO sum_d, sum_c, cnt
      FROM journal_lines
     WHERE voucher_id = NEW.id;

    IF cnt < 2 THEN
      RAISE EXCEPTION 'VALIDATION: voucher % has fewer than 2 journal lines', NEW.id;
    END IF;
    IF sum_d <> sum_c THEN
      RAISE EXCEPTION 'UNBALANCED: voucher % lines sum to debit=% credit=%', NEW.id, sum_d, sum_c;
    END IF;
    IF sum_d <= 0 THEN
      RAISE EXCEPTION 'VALIDATION: voucher % has non-positive total', NEW.id;
    END IF;
    IF sum_d <> NEW.total_debit OR sum_c <> NEW.total_credit THEN
      RAISE EXCEPTION 'UNBALANCED: header totals (debit=% credit=%) disagree with lines (debit=% credit=%)',
        NEW.total_debit, NEW.total_credit, sum_d, sum_c;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER voucher_balance_check
  AFTER INSERT OR UPDATE ON vouchers
  FOR EACH ROW EXECUTE FUNCTION enforce_voucher_balance();
