-- 0001_initial/down.sql
DROP TRIGGER IF EXISTS voucher_balance_check ON vouchers;
DROP TRIGGER IF EXISTS voucher_no_delete ON vouchers;
DROP TRIGGER IF EXISTS voucher_immutability ON vouchers;
DROP FUNCTION IF EXISTS enforce_voucher_balance();
DROP FUNCTION IF EXISTS enforce_voucher_no_delete();
DROP FUNCTION IF EXISTS enforce_voucher_immutability();
DROP FUNCTION IF EXISTS neurobook_current_tenant();

DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS parties CASCADE;
DROP TABLE IF EXISTS idempotency_keys CASCADE;
DROP TABLE IF EXISTS journal_lines CASCADE;
DROP TABLE IF EXISTS vouchers CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS voucher_sequences CASCADE;
DROP TABLE IF EXISTS fiscal_periods CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

DROP TYPE IF EXISTS party_type;
DROP TYPE IF EXISTS fiscal_period_status;
DROP TYPE IF EXISTS voucher_type;
DROP TYPE IF EXISTS voucher_status;
DROP TYPE IF EXISTS account_type;
