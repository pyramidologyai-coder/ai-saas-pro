-- Defensive RLS/RBAC cleanup draft only. Do not apply without explicit approval.
--
-- Scope:
-- - Supplement the reviewed 20260604 17-policy migration only for remaining
--   unsafe policy names that were not part of that migration.
-- - Replace repo-defined trigger functions that used hardcoded master-admin
--   email allowlists with public.is_master_admin().
-- - Keep raw_user_meta_data as untrusted signup input only, with validation
--   before tenant onboarding persistence.
-- - Fail closed if live-only dashboard/helper functions exist but have no
--   repo definition here to review. This avoids fabricating function bodies.
--
-- No data backfill, production execution, deploy, or database write is
-- performed by creating this file locally.

DO $$
BEGIN
  IF to_regprocedure('public.is_master_admin()') IS NULL THEN
    RAISE EXCEPTION 'Required helper public.is_master_admin() does not exist';
  END IF;
END
$$;

-- Supplemental policies not covered by
-- 20260604_replace_unsafe_master_admin_rls.sql.
DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "read_audit_logs" ON public.audit_logs';
    EXECUTE 'CREATE POLICY "read_audit_logs" ON public.audit_logs FOR SELECT USING (public.is_master_admin())';
  END IF;

  IF to_regclass('public.plans') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'plans'
         AND column_name = 'archived_at'
     ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "all_read_plans" ON public.plans';
    EXECUTE 'CREATE POLICY "all_read_plans" ON public.plans FOR SELECT USING (archived_at IS NULL OR public.is_master_admin())';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.prevent_agency_deletions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.role() = 'service_role' OR public.is_master_admin() THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Security Violation: Deletion of tenants is strictly prohibited. Please suspend the account instead.';
END;
$function$;

REVOKE ALL ON FUNCTION public.prevent_agency_deletions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_agency_deletions() TO service_role;

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS block_tenant_deletions ON public.tenants;
    CREATE TRIGGER block_tenant_deletions
      BEFORE DELETE ON public.tenants
      FOR EACH ROW EXECUTE FUNCTION public.prevent_agency_deletions();
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.prevent_financial_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.role() = 'service_role' OR public.is_master_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.subscription_tier IS DISTINCT FROM 'trial' THEN
      RAISE EXCEPTION 'Security Violation: Cannot insert a non-trial subscription tier.';
    END IF;

    IF NEW.status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'Security Violation: Initial status must be active.';
    END IF;

    IF NEW.trial_ends_at > (CURRENT_TIMESTAMP + INTERVAL '14 days') THEN
      RAISE EXCEPTION 'Security Violation: Trial period exceeds maximum allowed limits.';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
      RAISE EXCEPTION 'Security Violation: Cannot manually alter subscription tier.';
    END IF;

    IF NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
      RAISE EXCEPTION 'Security Violation: Cannot manually alter trial expiration date.';
    END IF;

    IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
      RAISE EXCEPTION 'Security Violation: Cannot manually reassign agency ownership.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.prevent_financial_tampering() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_financial_tampering() TO service_role;

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS enforce_financial_integrity ON public.tenants;
    CREATE TRIGGER enforce_financial_integrity
      BEFORE INSERT OR UPDATE ON public.tenants
      FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_tampering();
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.prevent_status_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.role() = 'service_role' OR public.is_master_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'tenants' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Security Violation: Cannot manually alter account status.';
    END IF;

    IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
      RAISE EXCEPTION 'Security Violation: Cannot manually alter subscription tier.';
    END IF;

    IF NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
      RAISE EXCEPTION 'Security Violation: Cannot manually alter trial expiration date.';
    END IF;

    IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
      RAISE EXCEPTION 'Security Violation: Cannot manually reassign agency ownership.';
    END IF;
  ELSIF TG_TABLE_NAME = 'agencies' THEN
    IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
      RAISE EXCEPTION 'Security Violation: Cannot manually alter agency subscription status.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.prevent_status_tampering() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_status_tampering() TO service_role;

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS block_status_tamper ON public.tenants;
    CREATE TRIGGER block_status_tamper
      BEFORE UPDATE ON public.tenants
      FOR EACH ROW EXECUTE FUNCTION public.prevent_status_tampering();
  END IF;

  IF to_regclass('public.agencies') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS enforce_agency_status ON public.agencies;
    CREATE TRIGGER enforce_agency_status
      BEFORE UPDATE ON public.agencies
      FOR EACH ROW EXECUTE FUNCTION public.prevent_status_tampering();
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
DECLARE
  v_business_name text;
  v_business_type text;
  v_slug_base text;
  v_slug text;
  v_trial_ends_at timestamptz;
BEGIN
  v_business_name := left(
    btrim(regexp_replace(COALESCE(new.raw_user_meta_data->>'business_name', ''), '[[:cntrl:]]+', ' ', 'g')),
    100
  );

  IF v_business_name IS NULL OR v_business_name = '' THEN
    v_business_name := 'New Business';
  END IF;

  v_business_type := lower(btrim(COALESCE(new.raw_user_meta_data->>'business_type', 'clinic')));
  v_business_type := CASE
    WHEN v_business_type IN ('clinic', 'restaurant', 'salon', 'real_estate', 'car_rental', 'ecommerce') THEN v_business_type
    ELSE 'clinic'
  END;

  v_slug_base := btrim(lower(regexp_replace(v_business_name, '[^a-zA-Z0-9]+', '-', 'g')), '-');
  IF v_slug_base IS NULL OR v_slug_base = '' THEN
    v_slug_base := 'business';
  END IF;

  v_slug := left(v_slug_base, 80) || '-' || substr(replace(new.id::text, '-', ''), 1, 8);
  v_trial_ends_at := CURRENT_TIMESTAMP + INTERVAL '7 days';

  INSERT INTO public.tenants (user_id, name, type, slug, trial_ends_at)
  VALUES (new.id, v_business_name, v_business_type, v_slug, v_trial_ends_at)
  ON CONFLICT (slug) DO NOTHING;

  RETURN new;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user_tenant() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user_tenant() TO service_role;

DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_tenant();
  END IF;
END
$$;

-- Live function replacements from the SELECT-only focused review.
-- These preserve the existing business calculations while replacing email
-- allowlists and user_metadata authorization with public.is_master_admin().

CREATE OR REPLACE FUNCTION public.block_status_tamper()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF auth.role() = 'service_role' OR public.is_master_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Security Alert: Status modification denied.';
  END IF;

  IF TG_TABLE_NAME = 'tenants' THEN
    IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
       OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
       OR NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
      RAISE EXCEPTION 'Security Alert: Financial tampering denied.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.block_status_tamper() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.block_status_tamper() TO service_role;

CREATE OR REPLACE FUNCTION public.block_tenant_deletions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF auth.role() = 'service_role' OR public.is_master_admin() THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Action Not Allowed: Deleting a tenant deletes their invoice history, violating financial compliance. Please set status to suspended instead.';
END;
$function$;

REVOKE ALL ON FUNCTION public.block_tenant_deletions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.block_tenant_deletions() TO service_role;

CREATE OR REPLACE FUNCTION public.prevent_agency_deletion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF auth.role() = 'service_role' OR public.is_master_admin() THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Action Not Allowed: Only the Master Admin can delete an agency. Please suspend the agency instead.';
END;
$function$;

REVOKE ALL ON FUNCTION public.prevent_agency_deletion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_agency_deletion() TO service_role;

CREATE OR REPLACE FUNCTION public.calculate_master_revenue()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_agencies DECIMAL := 0;
  v_direct DECIMAL := 0;
BEGIN
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COALESCE(SUM(COALESCE(p.price_monthly, 0)), 0)
  INTO v_agencies
  FROM agencies a
  LEFT JOIN plans p ON p.slug = a.plan_type AND p.is_active = TRUE
  WHERE a.status = 'active';

  SELECT COALESCE(SUM(COALESCE(p.price_monthly, 0)), 0)
  INTO v_direct
  FROM tenants t
  LEFT JOIN plans p ON p.slug = t.plan_type AND p.is_active = TRUE
  WHERE t.agency_id IS NULL AND t.status = 'active';

  RETURN v_agencies + v_direct;
END;
$function$;

REVOKE ALL ON FUNCTION public.calculate_master_revenue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_master_revenue() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.calculate_usage_rate()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_rate DECIMAL := 0;
BEGIN
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COALESCE(AVG(
    CASE WHEN messages_limit > 0
      THEN LEAST((messages_used::DECIMAL / messages_limit) * 100, 100)
      ELSE 0
    END
  ), 0) INTO v_rate
  FROM tenants
  WHERE status = 'active' AND messages_limit > 0;

  RETURN ROUND(v_rate, 1);
END;
$function$;

REVOKE ALL ON FUNCTION public.calculate_usage_rate() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_usage_rate() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.count_high_usage_tenants()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_count INT;
BEGIN
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COALESCE(COUNT(*), 0)
  INTO v_count
  FROM tenants
  WHERE messages_limit > 0
    AND messages_used >= FLOOR(messages_limit * 0.8);

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.count_high_usage_tenants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_high_usage_tenants() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.count_today_messages()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_count INT;
  v_today TIMESTAMP;
BEGIN
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_today := DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC');

  SELECT COALESCE(COUNT(*), 0)
  INTO v_count
  FROM conversations
  WHERE created_at >= v_today;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.count_today_messages() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_today_messages() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_master_dashboard_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_agencies_count INT;
  v_tenants_count INT;
  v_messages_today INT;
  v_expiring_count INT;
  v_high_usage_count INT;
  v_revenue DECIMAL;
  v_usage_rate DECIMAL;
  v_agencies_growth INT;
  v_recent_agencies JSON;
  v_now TIMESTAMP := NOW() AT TIME ZONE 'UTC';
  v_in_7_days TIMESTAMP := v_now + INTERVAL '7 days';
  v_this_month_start TIMESTAMP := DATE_TRUNC('month', v_now);
  v_last_month_start TIMESTAMP := DATE_TRUNC('month', v_now - INTERVAL '1 month');
  v_this_month_count INT;
  v_last_month_count INT;
BEGIN
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COUNT(*) INTO v_agencies_count FROM agencies WHERE subscription_status = 'active';
  SELECT COUNT(*) INTO v_tenants_count FROM tenants;
  SELECT COALESCE(COUNT(*), 0) INTO v_messages_today FROM messages WHERE created_at >= DATE_TRUNC('day', v_now);

  SELECT COUNT(*) INTO v_expiring_count FROM agencies
  WHERE subscription_end_date IS NOT NULL
    AND subscription_end_date <= v_in_7_days
    AND subscription_status = 'active';

  SELECT COUNT(*) INTO v_high_usage_count FROM tenants
  WHERE messages_limit > 0 AND (messages_used::float / messages_limit::float) >= 0.8;

  SELECT COALESCE(SUM(revenue), 0) INTO v_revenue FROM tenants;

  SELECT COALESCE(AVG(CASE WHEN messages_limit > 0 THEN (messages_used::float / messages_limit::float) * 100 ELSE 0 END), 0)
  INTO v_usage_rate FROM tenants;

  SELECT COUNT(*) INTO v_this_month_count FROM agencies WHERE created_at >= v_this_month_start;
  SELECT COUNT(*) INTO v_last_month_count FROM agencies WHERE created_at >= v_last_month_start AND created_at < v_this_month_start;

  IF v_last_month_count = 0 THEN
    v_agencies_growth := CASE WHEN v_this_month_count > 0 THEN 100 ELSE 0 END;
  ELSE
    v_agencies_growth := ((v_this_month_count - v_last_month_count)::float / v_last_month_count::float * 100)::int;
  END IF;

  SELECT COALESCE(json_agg(t), '[]'::json) INTO v_recent_agencies
  FROM (
    SELECT a.id, a.name, a.plan_type, a.subscription_status as status, a.created_at,
           (SELECT COUNT(*) FROM tenants WHERE agency_id = a.id) as tenants_count
    FROM agencies a
    ORDER BY a.created_at DESC
    LIMIT 5
  ) t;

  RETURN json_build_object(
    'agenciesCount', v_agencies_count,
    'tenantsCount', v_tenants_count,
    'totalMessagesToday', v_messages_today,
    'expiringCount', v_expiring_count,
    'highUsageCount', v_high_usage_count,
    'totalRevenue', v_revenue,
    'agenciesGrowth', v_agencies_growth,
    'usageRate', v_usage_rate,
    'recentAgencies', v_recent_agencies
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_master_dashboard_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_master_dashboard_data() TO authenticated, service_role;

-- Tenant API key hash exposure was verified in application code:
-- list/create/revoke/rotate DTO selects omit key_hash, and key_hash is selected
-- only in server-only authentication verification. No comment-only schema
-- change is included here.

-- Post-apply verification queries, comments only:
-- SELECT schemaname, tablename, policyname, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND (
--     qual ILIKE '%user_metadata%'
--     OR with_check ILIKE '%user_metadata%'
--     OR qual ILIKE '%raw_user_meta_data%'
--     OR with_check ILIKE '%raw_user_meta_data%'
--     OR qual ILIKE '%auth.jwt()%email%'
--     OR with_check ILIKE '%auth.jwt()%email%'
--   )
-- ORDER BY tablename, policyname;
--
-- SELECT p.proname, pg_get_functiondef(p.oid)
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN (
--     'block_status_tamper',
--     'block_tenant_deletions',
--     'calculate_master_revenue',
--     'calculate_usage_rate',
--     'count_high_usage_tenants',
--     'count_today_messages',
--     'get_master_dashboard_data',
--     'prevent_agency_deletion',
--     'prevent_agency_deletions',
--     'prevent_financial_tampering',
--     'prevent_status_tampering',
--     'handle_new_user_tenant'
--   )
--   AND (
--     pg_get_functiondef(p.oid) ILIKE '%user_metadata%'
--     OR pg_get_functiondef(p.oid) ILIKE '%auth.jwt()%email%'
--   )
-- ORDER BY p.proname;
--
-- Rollback guidance:
-- Create a new reviewed migration that restores the last approved trusted
-- helper-based policy/function definitions. Do not roll back to hardcoded
-- email allowlists or user_metadata authorization.
