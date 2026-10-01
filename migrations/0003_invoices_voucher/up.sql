-- 0003_invoices_voucher/up.sql
ALTER TABLE invoices ADD COLUMN voucher_id text;
CREATE INDEX invoices_voucher_idx ON invoices (tenant_id, voucher_id);
