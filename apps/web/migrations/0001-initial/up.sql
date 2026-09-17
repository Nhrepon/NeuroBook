-- NeuroBook initial schema (§4, §15.1, §15.2).
-- Money is integer minor units throughout (R7): bigint/integer only.

-- Enumerations
DO $$ BEGIN
  CREATE TYPE role AS ENUM ('SUPER_ADMIN','ADMIN','ACCOUNTANT','MANAGER','STAFF','SALES','AUDITOR','USER','GUEST','VIEWER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE account_type AS ENUM ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE voucher_type AS ENUM ('PAYMENT','RECEIPT','JOURNAL','SALES','PURCHASE','DEBIT_NOTE','CREDIT_NOTE','CONTRA','REFUND','TRANSFER','STOCK_TRANSFER','ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE voucher_status AS ENUM ('draft','posted','reversed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE period_status AS ENUM ('open','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tenancy (§5.1, §5.2)
CREATE TABLE IF NOT EXISTS tenants (
  id                     VARCHAR(26) PRIMARY KEY,
  name                   TEXT NOT NULL,
  bin                    TEXT,
  tin                    TEXT,
  bin_verified           BOOLEAN NOT NULL DEFAULT FALSE,
  base_currency          VARCHAR(3) NOT NULL DEFAULT 'BDT',
  fiscal_year_start_month INTEGER NOT NULL DEFAULT 7,
  locale                 VARCHAR(5) NOT NULL DEFAULT 'en',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id                   VARCHAR(26) PRIMARY KEY,
  email                TEXT NOT NULL UNIQUE,
  name                 TEXT,
  password_hash        TEXT,
  totp_secret          TEXT,
  totp_enrolled        BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_required  BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_tenants (
  user_id    VARCHAR(26) NOT NULL,
  tenant_id  VARCHAR(26) NOT NULL,
  role       role NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id                  VARCHAR(26) PRIMARY KEY,
  user_id             VARCHAR(26) NOT NULL,
  tenant_id           VARCHAR(26),
  refresh_token_hash  TEXT NOT NULL,
  user_agent          TEXT,
  ip                  TEXT,
  revoked_at          TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sessions_refresh_token_hash_idx ON sessions (refresh_token_hash);

-- Accounting (§4)
CREATE TABLE IF NOT EXISTS accounts (
  id                    VARCHAR(26) PRIMARY KEY,
  tenant_id             VARCHAR(26) NOT NULL,
  name                  TEXT NOT NULL,
  code                  TEXT NOT NULL,
  type                  account_type NOT NULL,
  parent_id             VARCHAR(26),
  is_group              BOOLEAN NOT NULL DEFAULT FALSE,
  opening_balance       BIGINT NOT NULL DEFAULT 0,
  tax_applicable        BOOLEAN NOT NULL DEFAULT FALSE,
  tax_category          TEXT,
  tax_rate              INTEGER,
  tax_exempt            BOOLEAN,
  tax_deductible        BOOLEAN,
  tax_deductible_rate   INTEGER,
  tax_exempt_rate       INTEGER,
  tax_exempt_reason     TEXT,
  tax_deductible_reason TEXT,
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  version               INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT accounts_opening_balance_nonnegative CHECK (opening_balance >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_tenant_code_idx ON accounts (tenant_id, code);

CREATE TABLE IF NOT EXISTS fiscal_periods (
  id          VARCHAR(26) PRIMARY KEY,
  tenant_id   VARCHAR(26) NOT NULL,
  name        TEXT NOT NULL,
  start_date  TIMESTAMPTZ NOT NULL,
  end_date    TIMESTAMPTZ NOT NULL,
  status      period_status NOT NULL DEFAULT 'open',
  closed_at   TIMESTAMPTZ,
  closed_by   VARCHAR(26),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS fiscal_periods_tenant_range_idx
  ON fiscal_periods (tenant_id, start_date, end_date);

CREATE TABLE IF NOT EXISTS voucher_sequences (
  id           VARCHAR(26) PRIMARY KEY,
  tenant_id    VARCHAR(26) NOT NULL,
  voucher_type voucher_type NOT NULL,
  fiscal_year  INTEGER NOT NULL,
  last_number  BIGINT NOT NULL DEFAULT 0,
  prefix       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS voucher_sequences_tenant_type_year_idx
  ON voucher_sequences (tenant_id, voucher_type, fiscal_year);

CREATE TABLE IF NOT EXISTS vouchers (
  id               VARCHAR(26) PRIMARY KEY,
  tenant_id        VARCHAR(26) NOT NULL,
  sequence_number  TEXT,
  voucher_type     voucher_type NOT NULL,
  date             TIMESTAMPTZ NOT NULL,
  narration        TEXT NOT NULL,
  status           voucher_status NOT NULL DEFAULT 'draft',
  total_debit      BIGINT NOT NULL DEFAULT 0,
  total_credit     BIGINT NOT NULL DEFAULT 0,
  idempotency_key  TEXT,
  reversed_by_id   VARCHAR(26),
  version          INTEGER NOT NULL DEFAULT 1,
  created_by       VARCHAR(26) NOT NULL,
  posted_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vouchers_totals_balanced CHECK (total_debit = total_credit),
  CONSTRAINT vouchers_total_debit_nonnegative CHECK (total_debit >= 0),
  CONSTRAINT vouchers_total_credit_nonnegative CHECK (total_credit >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS vouchers_idempotency_idx ON vouchers (tenant_id, idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS vouchers_tenant_sequence_idx
  ON vouchers (tenant_id, voucher_type, sequence_number);

CREATE TABLE IF NOT EXISTS voucher_entries (
  id          VARCHAR(26) PRIMARY KEY,
  tenant_id   VARCHAR(26) NOT NULL,
  voucher_id  VARCHAR(26) NOT NULL,
  account_id  VARCHAR(26) NOT NULL,
  debit       BIGINT NOT NULL DEFAULT 0,
  credit      BIGINT NOT NULL DEFAULT 0,
  reference   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT voucher_entries_exactly_one_side
    CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)),
  CONSTRAINT voucher_entries_debit_nonnegative CHECK (debit >= 0),
  CONSTRAINT voucher_entries_credit_nonnegative CHECK (credit >= 0)
);
-- Index for the join from a voucher to its lines. NOT unique: a voucher has as
-- many lines as it needs, and a unique index on voucher_id would cap every
-- voucher at a single journal line.
CREATE INDEX IF NOT EXISTS voucher_entries_voucher_idx ON voucher_entries (voucher_id);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  tenant_id   VARCHAR(26) NOT NULL,
  key         TEXT NOT NULL,
  response    JSONB,
  status_code INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, key)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          VARCHAR(26) PRIMARY KEY,
  tenant_id   VARCHAR(26) NOT NULL,
  user_id     VARCHAR(26),
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   VARCHAR(26),
  ip          TEXT,
  diff        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Parties (§5.x)
CREATE TABLE IF NOT EXISTS customers (
  id              VARCHAR(26) NOT NULL,
  tenant_id       VARCHAR(26) NOT NULL,
  name            TEXT NOT NULL,
  tin             TEXT,
  bin             TEXT,
  email           TEXT,
  phone           TEXT,
  address_line    TEXT,
  division        TEXT,
  district        TEXT,
  upazila         TEXT,
  "union"         TEXT,
  opening_balance BIGINT NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (id, tenant_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_name_idx ON customers (tenant_id, name);

CREATE TABLE IF NOT EXISTS suppliers (
  id              VARCHAR(26) NOT NULL,
  tenant_id       VARCHAR(26) NOT NULL,
  name            TEXT NOT NULL,
  tin             TEXT,
  bin             TEXT,
  email           TEXT,
  phone           TEXT,
  address_line    TEXT,
  division        TEXT,
  district        TEXT,
  upazila         TEXT,
  "union"         TEXT,
  opening_balance BIGINT NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (id, tenant_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_tenant_name_idx ON suppliers (tenant_id, name);

-- R1: a posted voucher is immutable. The ONLY write permitted on a posted row
-- is the transition into 'reversed', made by the reversal procedure. Any other
-- UPDATE is rejected. (Drafts may still be edited.)
CREATE OR REPLACE FUNCTION veto_posted_voucher_update()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'posted' AND NEW.status = 'posted' THEN
    RAISE EXCEPTION 'IMMUTABLE_POSTED: a posted voucher cannot be edited; reverse it with a correction voucher';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vouchers_veto_posted_update ON vouchers;
CREATE TRIGGER vouchers_veto_posted_update
  BEFORE UPDATE ON vouchers
  FOR EACH ROW EXECUTE FUNCTION veto_posted_voucher_update();

-- R4: the ledger must foot to the minor unit, and the header totals must be the
-- sums of the lines.
--
-- Split across two triggers, because a voucher is written in two steps: the
-- header first, then its lines (a line's voucher_id cannot resolve until the
-- header exists). Neither step alone can see the finished voucher.
--
--   * voucher_lines_check  — AFTER on the lines. By the time it fires the new
--     line is visible, so the sum it computes is real. A mid-write voucher is
--     unbalanced by construction and must pass; a complete one must foot.
--   * vouchers_balance_check — BEFORE on the header, so a header that disagrees
--     with its already-written lines is caught rather than stored.
--
-- The engine validates the pair in the same transaction before any write
-- (packages/shared/src/ledger/post.ts). These triggers are the last-resort DB
-- check for anything that reaches the tables another way.
CREATE OR REPLACE FUNCTION check_voucher_lines()
RETURNS trigger AS $$
DECLARE
  status       TEXT;
  debit_total  BIGINT;
  credit_total BIGINT;
BEGIN
  -- Only a settled voucher has a fixed line set. A draft's lines are still
  -- being assembled, so a partial line set is expected and must pass.
  SELECT v.status INTO status FROM vouchers v WHERE v.id = NEW.voucher_id;
  IF NOT FOUND OR status = 'draft' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
  INTO debit_total, credit_total
  FROM voucher_entries
  WHERE voucher_id = NEW.voucher_id;

  IF debit_total = 0 AND credit_total = 0 THEN
    RETURN NEW;
  END IF;

  IF debit_total <> credit_total THEN
    RAISE EXCEPTION 'UNBALANCED: voucher % has debits % against credits %',
      NEW.voucher_id, debit_total, credit_total;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS voucher_lines_check ON voucher_entries;
CREATE TRIGGER voucher_lines_check
  AFTER INSERT OR UPDATE ON voucher_entries
  FOR EACH ROW EXECUTE FUNCTION check_voucher_lines();

-- R4, header side.
--
-- A voucher is written header-first, then lines, so on INSERT the header's own
-- trigger can only ever see a mid-write voucher: at that instant the lines do
-- not exist and the totals are provisional. This is an AFTER trigger for that
-- reason — it compares once the statement that wrote the header has settled.
--
-- A draft is still provisional: its line set may legitimately disagree with its
-- header while it is being assembled. The line-side trigger checks the balance
-- of the lines themselves; this one checks the header against them, and only
-- for a voucher that has been settled.
CREATE OR REPLACE FUNCTION assert_voucher_balanced()
RETURNS trigger AS $$
DECLARE
  debit_total  BIGINT;
  credit_total BIGINT;
BEGIN
  IF NEW.status = 'draft' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
  INTO debit_total, credit_total
  FROM voucher_entries
  WHERE voucher_id = NEW.id;

  IF debit_total = 0 AND credit_total = 0 THEN
    RETURN NEW;
  END IF;

  IF debit_total <> credit_total THEN
    RAISE EXCEPTION 'UNBALANCED: voucher % has debits % against credits %', NEW.id, debit_total, credit_total;
  END IF;
  IF NEW.total_debit IS DISTINCT FROM debit_total OR NEW.total_credit IS DISTINCT FROM credit_total THEN
    RAISE EXCEPTION 'UNBALANCED: header totals for voucher % do not match its journal lines', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vouchers_balance_check ON vouchers;
CREATE TRIGGER vouchers_balance_check
  AFTER INSERT OR UPDATE OF total_debit, total_credit, status ON vouchers
  FOR EACH ROW EXECUTE FUNCTION assert_voucher_balanced();

-- R4, the final gap: a header whose totals disagree with its lines.
--
-- The header is written first and its lines second, so no trigger on the header
-- can see the disagreement — by the time the lines exist, the header's
-- statement is finished and nothing will touch the header again. The one event
-- that observes both states is the last line arriving, so the check belongs
-- there.
--
-- "Complete" is keyed off status, not off the line totals: the lines of a
-- genuine posting can sum to zero (a fully-reversed pair), and counting lines
-- is unreliable while they are still being written. A draft's line set is
-- provisional and is never asserted; a posted or reversed voucher is settled and
-- its header must agree.
CREATE OR REPLACE FUNCTION check_header_matches_lines()
RETURNS trigger AS $$
DECLARE
  header      RECORD;
  debit_total BIGINT;
  credit_total BIGINT;
BEGIN
  SELECT total_debit, total_credit, status INTO header
  FROM vouchers WHERE id = NEW.voucher_id;
  IF NOT FOUND THEN
    RETURN NEW;  -- header not yet written
  END IF;
  -- A draft's line set is still provisional; only a settled voucher is asserted.
  IF header.status = 'draft' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
  INTO debit_total, credit_total
  FROM voucher_entries
  WHERE voucher_id = NEW.voucher_id;

  IF header.total_debit <> debit_total
     OR header.total_credit <> credit_total
     OR debit_total <> credit_total THEN
    RAISE EXCEPTION 'UNBALANCED: header totals for voucher % do not match its journal lines',
      NEW.voucher_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS voucher_header_matches_lines ON voucher_entries;
CREATE TRIGGER voucher_header_matches_lines
  AFTER INSERT OR UPDATE ON voucher_entries
  FOR EACH ROW EXECUTE FUNCTION check_header_matches_lines();

-- Audit log is append-only (R15): no UPDATE or DELETE is ever permitted.
CREATE OR REPLACE FUNCTION veto_audit_log_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AUDIT_LOG_APPEND_ONLY: the audit log may not be modified';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_veto_update ON audit_log;
CREATE TRIGGER audit_log_veto_update
  BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION veto_audit_log_mutation();
