-- =========================================================================
-- SECURITY FIX: Master Admin Role Verification
-- =========================================================================
-- Recreates master-admin helper functions so application and RLS checks use
-- Supabase auth.users.raw_app_meta_data, which is controlled by trusted server
-- operations rather than user-editable metadata or hardcoded email lists.
--
-- IMPORTANT: This migration intentionally does NOT create an arbitrary SQL
-- execution helper. Diagnostic SQL runners such as exec_sql are not appropriate
-- for application migrations because they expand the blast radius of service
-- role credentials.

CREATE OR REPLACE FUNCTION public.verify_master_admin_role()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = auth.uid()
      AND raw_app_meta_data->>'role' = 'master_admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = auth.uid()
      AND raw_app_meta_data->>'role' = 'master_admin'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_master_admin_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_master_admin() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.verify_master_admin_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_master_admin() TO authenticated, service_role;
