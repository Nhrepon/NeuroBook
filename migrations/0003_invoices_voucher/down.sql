-- 0003_invoices_voucher/down.sql
DROP INDEX IF EXISTS invoices_voucher_idx;
ALTER TABLE invoices DROP COLUMN IF EXISTS voucher_id;
