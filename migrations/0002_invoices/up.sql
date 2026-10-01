-- 0002_invoices/up.sql
CREATE TABLE invoices (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id   text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id text REFERENCES parties(id),
  date        timestamptz NOT NULL,
  payload     jsonb NOT NULL,
  pdf_url     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoices_tenant_date_idx ON invoices (tenant_id, date);

-- R9: invoices is tenant-scoped.
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON invoices
  USING (tenant_id = neurobook_current_tenant());
