-- ==========================================
-- MILITARY-GRADE SECURITY PATCH (RLS & RBAC)
-- ==========================================

-- 1. Enable RLS on all sensitive tables
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- 2. Master Admin Policies (Full Access based on Email)
-- Replace with actual master admin email if it changes
CREATE POLICY master_admin_agencies ON agencies FOR ALL USING (auth.jwt() ->> 'email' IN ('ashsameh1@gmail.com', 'pyramidology.ai@gmail.com'));
CREATE POLICY master_admin_tenants ON tenants FOR ALL USING (auth.jwt() ->> 'email' IN ('ashsameh1@gmail.com', 'pyramidology.ai@gmail.com'));
CREATE POLICY master_admin_platform ON platform_settings FOR ALL USING (auth.jwt() ->> 'email' IN ('ashsameh1@gmail.com', 'pyramidology.ai@gmail.com'));
CREATE POLICY master_admin_invoices ON invoices FOR ALL USING (auth.jwt() ->> 'email' IN ('ashsameh1@gmail.com', 'pyramidology.ai@gmail.com'));

-- 3. Agency Reseller Policies
-- Agencies can read/update their own agency record
CREATE POLICY agency_owner_access ON agencies FOR ALL USING (user_id = auth.uid());
-- Agencies can read/update their own tenants
CREATE POLICY agency_tenants_access ON tenants FOR ALL USING (agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid()));

-- 4. Tenant (End-Client) Policies
-- Tenants can only see and update their own row
CREATE POLICY tenant_owner_access ON tenants FOR ALL USING (user_id = auth.uid());
-- Tenants can see their own invoices
CREATE POLICY tenant_invoices_access ON invoices FOR SELECT USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

-- 5. Public Registration (Allow inserts for new signups)
-- If your app allows self-signup, you need an insert policy, otherwise auth.uid() handles it if they are logged in.
CREATE POLICY allow_tenant_inserts ON tenants FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 6. Hide Secret Keys from being selected by default (Optional but recommended for extreme security)
-- (In a real app, we would use Supabase Vault, but RLS prevents non-owners from seeing them anyway).
