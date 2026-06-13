-- LOCAL-ONLY DRAFT v2.2: DB/RLS grant hardening.
-- Prepared from the verified SELECT-only live inventory dated 2026-06-12.
-- NOT APPLIED. Requires Hermes review and separate staging-apply approval.
--
-- Scope:
-- - Harden public.get_agency_commission(uuid).
-- - Fail closed unless the expected 42 live public SECURITY DEFINER function
--   signatures exist exactly and no unexpected public SECURITY DEFINER
--   signatures are present.
-- - Do not alter pgbouncer.get_auth(text) or either vault function.
-- - Revoke dangerous table privileges from PUBLIC/anon/authenticated and fail
--   closed if anon/authenticated retain effective inherited privileges.
-- - Do not modify RLS policies or table data.

-- PRE-APPLY BLOCKER:
-- Capture and approve the exact live pg_get_functiondef/proconfig/search_path
-- snapshot for public.is_master_admin() before staging apply. This assertion
-- intentionally blocks v2.2 until that dependency has an approved fixed
-- search_path, either already present or delivered by a separate reviewed
-- search_path-hardening migration. Do not guess or replace its body here.
DO $$
DECLARE
  v_function oid := to_regprocedure('public.is_master_admin()');
  v_proconfig text[];
BEGIN
  IF v_function IS NULL THEN
    RAISE EXCEPTION 'Preflight failed: missing public.is_master_admin()';
  END IF;

  SELECT p.proconfig
  INTO v_proconfig
  FROM pg_proc AS p
  WHERE p.oid = v_function
    AND p.prosecdef;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Preflight failed: public.is_master_admin() is not SECURITY DEFINER';
  END IF;

  IF (
    v_proconfig @> ARRAY['search_path=public']::text[]
    OR v_proconfig @> ARRAY['search_path=pg_catalog, public']::text[]
  ) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION
      'Preflight failed: public.is_master_admin() requires an approved fixed search_path and exact live-body snapshot';
  END IF;
END
$$;

-- Fail closed on signature drift before replacing a body or changing grants.
DO $$
DECLARE
  v_expected text[] := ARRAY[
    'public.activate_agency_cascade(uuid)',
    'public.add_plan(text,text,numeric,numeric,integer,numeric,numeric,text,boolean,boolean,integer)',
    'public.add_plan(text,text,numeric,numeric,integer,numeric,numeric,text,boolean,boolean,integer,timestamp with time zone)',
    'public.add_wallet_credit(uuid,numeric,text)',
    'public.archive_plan(uuid)',
    'public.calculate_master_revenue()',
    'public.calculate_usage_rate()',
    'public.check_campaign_rate_limit()',
    'public.check_tenant_limit()',
    'public.count_high_usage_tenants()',
    'public.count_today_messages()',
    'public.create_agency(text,text,text,numeric,text)',
    'public.delete_plan(uuid)',
    'public.get_agency_commission(uuid)',
    'public.get_agency_wallet_balance(uuid)',
    'public.get_auth_owned_tenant_id()',
    'public.get_auth_profile_tenant_id()',
    'public.get_channel_analytics(integer)',
    'public.get_financial_overview()',
    'public.get_master_clients()',
    'public.get_master_dashboard_data()',
    'public.get_plan_usage(text)',
    'public.get_plans_with_stats()',
    'public.get_unique_customers_count(uuid)',
    'public.get_wallet_summary()',
    'public.get_wallet_transactions(integer,integer,uuid)',
    'public.handle_new_user_tenant()',
    'public.increment_message_usage(uuid)',
    'public.is_master_admin()',
    'public.prevent_agency_deletions()',
    'public.prevent_financial_tampering()',
    'public.prevent_sent_campaign_deletion()',
    'public.prevent_status_tampering()',
    'public.process_wallet_charge(uuid,uuid,numeric,text,character varying)',
    'public.protect_campaign_fields()',
    'public.send_usage_notification(uuid,uuid,text,text)',
    'public.suspend_agency_cascade(uuid)',
    'public.toggle_plan_status(uuid,boolean)',
    'public.update_plan_pricing(uuid,numeric,numeric)',
    'public.validate_campaign_insert()',
    'public.validate_campaign_status()',
    'public.verify_master_admin_role()'
  ];
  v_signature text;
  v_expected_oids oid[] := ARRAY[]::oid[];
  v_function oid;
  v_unexpected text[];
BEGIN
  IF cardinality(v_expected) <> 42 THEN
    RAISE EXCEPTION 'Preflight failed: expected-signature manifest must contain 42 entries';
  END IF;

  FOREACH v_signature IN ARRAY v_expected
  LOOP
    v_function := to_regprocedure(v_signature);
    IF v_function IS NULL THEN
      RAISE EXCEPTION 'Preflight failed: missing expected signature %', v_signature;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_proc AS p
      JOIN pg_namespace AS n ON n.oid = p.pronamespace
      WHERE p.oid = v_function
        AND n.nspname = 'public'
        AND p.prosecdef
    ) THEN
      RAISE EXCEPTION
        'Preflight failed: expected signature is not public SECURITY DEFINER: %',
        v_signature;
    END IF;

    v_expected_oids := array_append(v_expected_oids, v_function);
  END LOOP;

  SELECT array_agg(p.oid::regprocedure::text ORDER BY p.oid::regprocedure::text)
  INTO v_unexpected
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND NOT (p.oid = ANY(v_expected_oids));

  IF v_unexpected IS NOT NULL THEN
    RAISE EXCEPTION
      'Preflight failed: unexpected public SECURITY DEFINER signatures: %',
      array_to_string(v_unexpected, ', ');
  END IF;
END
$$;

-- PRE-APPLY BLOCKER:
-- Direct grants to PUBLIC/anon/authenticated are revoked below. Inherited
-- dangerous privileges require explicit role-membership review and must be
-- removed separately rather than silently changing role membership here.
DO $$
DECLARE
  v_inherited_grants text[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION
      'Preflight failed: required roles anon/authenticated do not both exist';
  END IF;

  SELECT array_agg(
    format(
      '%I.%I:%s via inherited role %I',
      n.nspname,
      c.relname,
      acl.privilege_type,
      inherited_role.rolname
    )
    ORDER BY n.nspname, c.relname, acl.privilege_type, inherited_role.rolname
  )
  INTO v_inherited_grants
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL aclexplode(
    COALESCE(c.relacl, acldefault('r', c.relowner))
  ) AS acl
  JOIN pg_roles AS inherited_role ON inherited_role.oid = acl.grantee
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND acl.privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER')
    AND inherited_role.rolname NOT IN ('anon', 'authenticated')
    AND (
      pg_has_role('anon', inherited_role.oid, 'USAGE')
      OR pg_has_role('authenticated', inherited_role.oid, 'USAGE')
    );

  IF v_inherited_grants IS NOT NULL THEN
    RAISE EXCEPTION
      'Preflight failed: inherited dangerous public-table grants require separate review/removal: %',
      array_to_string(v_inherited_grants, ', ');
  END IF;
END
$$;

-- The verified live body disclosed arbitrary agency commission rates without
-- an authorization check. Replace it before retaining authenticated execution.
CREATE OR REPLACE FUNCTION public.get_agency_commission(p_agency_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_commission numeric := 0;
BEGIN
  IF public.is_master_admin() IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Unauthorized';
  END IF;

  SELECT COALESCE(a.commission_rate, 0)
  INTO v_commission
  FROM public.agencies AS a
  WHERE a.id = p_agency_id;

  RETURN COALESCE(v_commission, 0);
END;
$function$;

-- Dispositions:
-- authenticated_service:
--   Keep direct authenticated execution only for reviewed identity/RLS tenant
--   helpers and the hardened commission RPC.
-- service_only:
--   Fail closed for triggers, mutations, and privileged/read RPCs whose exact
--   live authorization body has not been reviewed. This can break staging
--   workflows and must be reconciled before production approval.
DO $$
DECLARE
  v_signature text;
  v_disposition text;
  v_function regprocedure;
BEGIN
  FOR v_signature, v_disposition IN
    SELECT *
    FROM (VALUES
      ('public.activate_agency_cascade(uuid)', 'service_only'),
      ('public.add_plan(text,text,numeric,numeric,integer,numeric,numeric,text,boolean,boolean,integer)', 'service_only'),
      ('public.add_plan(text,text,numeric,numeric,integer,numeric,numeric,text,boolean,boolean,integer,timestamp with time zone)', 'service_only'),
      ('public.add_wallet_credit(uuid,numeric,text)', 'service_only'),
      ('public.archive_plan(uuid)', 'service_only'),
      ('public.calculate_master_revenue()', 'service_only'),
      ('public.calculate_usage_rate()', 'service_only'),
      ('public.check_campaign_rate_limit()', 'service_only'),
      ('public.check_tenant_limit()', 'service_only'),
      ('public.count_high_usage_tenants()', 'service_only'),
      ('public.count_today_messages()', 'service_only'),
      ('public.create_agency(text,text,text,numeric,text)', 'service_only'),
      ('public.delete_plan(uuid)', 'service_only'),
      ('public.get_agency_commission(uuid)', 'authenticated_service'),
      ('public.get_agency_wallet_balance(uuid)', 'service_only'),
      ('public.get_auth_owned_tenant_id()', 'authenticated_service'),
      ('public.get_auth_profile_tenant_id()', 'authenticated_service'),
      ('public.get_channel_analytics(integer)', 'service_only'),
      ('public.get_financial_overview()', 'service_only'),
      ('public.get_master_clients()', 'service_only'),
      ('public.get_master_dashboard_data()', 'service_only'),
      ('public.get_plan_usage(text)', 'service_only'),
      ('public.get_plans_with_stats()', 'service_only'),
      ('public.get_unique_customers_count(uuid)', 'service_only'),
      ('public.get_wallet_summary()', 'service_only'),
      ('public.get_wallet_transactions(integer,integer,uuid)', 'service_only'),
      ('public.handle_new_user_tenant()', 'service_only'),
      ('public.increment_message_usage(uuid)', 'service_only'),
      ('public.is_master_admin()', 'service_only'),
      ('public.prevent_agency_deletions()', 'service_only'),
      ('public.prevent_financial_tampering()', 'service_only'),
      ('public.prevent_sent_campaign_deletion()', 'service_only'),
      ('public.prevent_status_tampering()', 'service_only'),
      ('public.process_wallet_charge(uuid,uuid,numeric,text,character varying)', 'service_only'),
      ('public.protect_campaign_fields()', 'service_only'),
      ('public.send_usage_notification(uuid,uuid,text,text)', 'service_only'),
      ('public.suspend_agency_cascade(uuid)', 'service_only'),
      ('public.toggle_plan_status(uuid,boolean)', 'service_only'),
      ('public.update_plan_pricing(uuid,numeric,numeric)', 'service_only'),
      ('public.validate_campaign_insert()', 'service_only'),
      ('public.validate_campaign_status()', 'service_only'),
      ('public.verify_master_admin_role()', 'service_only')
    ) AS disposition(signature, disposition)
  LOOP
    v_function := to_regprocedure(v_signature);

    IF v_function IS NULL THEN
      RAISE EXCEPTION 'Grant phase failed: missing expected signature %', v_signature;
    END IF;

    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role',
      v_function
    );

    IF v_disposition = 'authenticated_service' THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role',
        v_function
      );
    ELSIF v_disposition = 'service_only' THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO service_role',
        v_function
      );
    ELSE
      RAISE EXCEPTION 'Unknown function disposition: %', v_disposition;
    END IF;
  END LOOP;
END
$$;

-- Preserve revocation of 126 verified dangerous privilege rows across the 21
-- affected public tables, and cover any additional public tables present when
-- this draft is eventually approved and applied.
DO $$
DECLARE
  v_table regclass;
BEGIN
  FOR v_table IN
    SELECT c.oid::regclass
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format(
      'REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE %s FROM PUBLIC, anon, authenticated',
      v_table
    );
  END LOOP;
END
$$;

-- Fail closed inside the same transaction if direct PUBLIC/anon/authenticated
-- grants or effective anon/authenticated privileges remain after revocation.
-- This catches inherited privileges and catalog visibility gaps that
-- information_schema.role_table_grants alone can miss.
DO $$
DECLARE
  v_remaining text[];
BEGIN
  SELECT array_agg(
    format('%I.%I:%s:%s', finding.table_schema, finding.table_name, finding.access_path, finding.privilege_type)
    ORDER BY finding.table_schema, finding.table_name, finding.access_path, finding.privilege_type
  )
  INTO v_remaining
  FROM (
    SELECT
      n.nspname AS table_schema,
      c.relname AS table_name,
      CASE
        WHEN acl.grantee = 0 THEN 'direct PUBLIC'
        ELSE format('direct %I', granted_role.rolname)
      END AS access_path,
      acl.privilege_type
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(
      COALESCE(c.relacl, acldefault('r', c.relowner))
    ) AS acl
    LEFT JOIN pg_roles AS granted_role ON granted_role.oid = acl.grantee
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND acl.privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER')
      AND (
        acl.grantee = 0
        OR granted_role.rolname IN ('anon', 'authenticated')
      )

    UNION

    SELECT
      n.nspname,
      c.relname,
      format('effective %I', checked_role.rolname),
      dangerous_privilege.privilege_type
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    CROSS JOIN (VALUES ('anon'), ('authenticated')) AS checked_role(rolname)
    CROSS JOIN (VALUES ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) AS dangerous_privilege(privilege_type)
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND has_table_privilege(
        checked_role.rolname::name,
        c.oid,
        dangerous_privilege.privilege_type
      )

    UNION

    SELECT
      grants.table_schema,
      grants.table_name,
      format('information_schema %I', grants.grantee),
      grants.privilege_type
    FROM information_schema.role_table_grants AS grants
    WHERE grants.table_schema = 'public'
      AND grants.grantee IN ('anon', 'authenticated')
      AND grants.privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER')
  ) AS finding;

  IF v_remaining IS NOT NULL THEN
    RAISE EXCEPTION
      'Grant hardening failed: dangerous public-table privileges remain: %',
      array_to_string(v_remaining, ', ');
  END IF;
END
$$;

-- Intentionally excluded from v2:
-- - pgbouncer.get_auth(text) and vault.create_secret/update_secret.
-- - CREATE OR REPLACE bodies for the other 12 missing-search_path functions.
-- - RLS policy rewrites for the 39 permissive policies targeting {public}.
-- - Table data DML, table shape changes, FORCE ROW LEVEL SECURITY, and secrets.

-- Conservative rollback guidance:
-- 1. Before apply, capture pg_get_functiondef, proacl/effective EXECUTE grants,
--    and direct/effective table privileges for every affected object.
-- 2. Do not restore the unsafe get_agency_commission(uuid) body.
-- 3. Restore only exact role/object privileges proven necessary from the
--    approved pre-apply snapshot. Do not broadly restore PUBLIC or anon.
-- 4. If a critical RPC fails, first fail closed by revoking its EXECUTE grant,
--    then deploy a separately reviewed body/grant correction.
--
-- SQL templates only; replace placeholders from the approved snapshot:
-- REVOKE EXECUTE ON FUNCTION public.<exact_signature> FROM authenticated;
-- GRANT EXECUTE ON FUNCTION public.<exact_signature> TO <exact_role>;
-- GRANT <TRUNCATE|REFERENCES|TRIGGER> ON TABLE public.<exact_table>
--   TO <reviewed_role_only>;
