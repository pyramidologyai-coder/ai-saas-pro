-- ========================================================
-- DYNAMIC MASTER ADMIN ROLE POLICIES (Fix #3)
-- ========================================================
-- Replaces hardcoded email-based policies with public.is_master_admin().
-- Must run after supabase-migrations-master-rbac-fix.sql.

-- Agencies
DROP POLICY IF EXISTS master_admin_agencies ON public.agencies;
CREATE POLICY master_admin_agencies ON public.agencies
  FOR ALL
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

-- Tenants
DROP POLICY IF EXISTS master_admin_tenants ON public.tenants;
CREATE POLICY master_admin_tenants ON public.tenants
  FOR ALL
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

-- Platform Settings
DROP POLICY IF EXISTS master_admin_platform ON public.platform_settings;
CREATE POLICY master_admin_platform ON public.platform_settings
  FOR ALL
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

-- Invoices
DROP POLICY IF EXISTS master_admin_invoices ON public.invoices;
CREATE POLICY master_admin_invoices ON public.invoices
  FOR ALL
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());
