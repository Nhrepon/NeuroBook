-- RLS template: enable and create tenant isolation policy per table.
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON accounts
  USING (tenant_id = neurobook_current_tenant());
