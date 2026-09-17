-- Reverses 0001-initial. Required by §15.5 O4 (reversible migrations).
-- Order is child-first to respect foreign-key dependencies.

DROP TRIGGER IF EXISTS audit_log_veto_update ON audit_log;
DROP FUNCTION IF EXISTS veto_audit_log_mutation();

DROP TRIGGER IF EXISTS vouchers_balance_check ON vouchers;
DROP FUNCTION IF EXISTS assert_voucher_balanced();
DROP TRIGGER IF EXISTS voucher_lines_check ON voucher_entries;
DROP FUNCTION IF EXISTS check_voucher_lines();
DROP TRIGGER IF EXISTS voucher_header_matches_lines ON voucher_entries;
DROP FUNCTION IF EXISTS check_header_matches_lines();

DROP TRIGGER IF EXISTS vouchers_veto_posted_update ON vouchers;
DROP FUNCTION IF EXISTS veto_posted_voucher_update();

DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS idempotency_keys;
DROP TABLE IF EXISTS voucher_entries;
DROP TABLE IF EXISTS vouchers;
DROP TABLE IF EXISTS voucher_sequences;
DROP TABLE IF EXISTS fiscal_periods;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS user_tenants;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS tenants;

DROP TYPE IF EXISTS period_status;
DROP TYPE IF EXISTS voucher_status;
DROP TYPE IF EXISTS voucher_type;
DROP TYPE IF EXISTS account_type;
DROP TYPE IF EXISTS role;
