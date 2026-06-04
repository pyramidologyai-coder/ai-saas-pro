-- Package D2 migration draft only. Do not apply without explicit approval.
-- Replaces unsafe user_metadata and hardcoded email master-admin RLS policies
-- with trusted helper-based authorization via public.is_master_admin().
-- Requires public.is_master_admin() to exist before running.
-- No data changes are performed by this migration.

DO $$
BEGIN
  IF to_regprocedure('public.is_master_admin()') IS NULL THEN
    RAISE EXCEPTION 'Required helper public.is_master_admin() does not exist';
  END IF;
END
$$;

DROP POLICY IF EXISTS "master_insert_audit_logs" ON public.audit_logs;
CREATE POLICY "master_insert_audit_logs"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "master_view_audit_logs" ON public.audit_logs;
CREATE POLICY "master_view_audit_logs"
  ON public.audit_logs
  FOR SELECT
  USING (public.is_master_admin());

DROP POLICY IF EXISTS "master_all_campaigns" ON public.campaigns;
CREATE POLICY "master_all_campaigns"
  ON public.campaigns
  FOR ALL
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "master_admin_agencies" ON public.agencies;
CREATE POLICY "master_admin_agencies"
  ON public.agencies
  FOR ALL
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "master_read_agencies" ON public.agencies;
CREATE POLICY "master_read_agencies"
  ON public.agencies
  FOR SELECT
  USING (public.is_master_admin());

DROP POLICY IF EXISTS "master_update_commission" ON public.agencies;
CREATE POLICY "master_update_commission"
  ON public.agencies
  FOR UPDATE
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "master_read_agency_plans" ON public.agency_plans;
CREATE POLICY "master_read_agency_plans"
  ON public.agency_plans
  FOR SELECT
  USING (public.is_master_admin());

DROP POLICY IF EXISTS "master_admin_bookings" ON public.bookings;
CREATE POLICY "master_admin_bookings"
  ON public.bookings
  FOR ALL
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "master_admin_branches" ON public.branches;
CREATE POLICY "master_admin_branches"
  ON public.branches
  FOR ALL
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "master_admin_invoices" ON public.invoices;
CREATE POLICY "master_admin_invoices"
  ON public.invoices
  FOR ALL
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "master_admin_items" ON public.items;
CREATE POLICY "master_admin_items"
  ON public.items
  FOR ALL
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "master_admin_messages" ON public.messages;
CREATE POLICY "master_admin_messages"
  ON public.messages
  FOR ALL
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "master_all_notifications" ON public.notifications;
CREATE POLICY "master_all_notifications"
  ON public.notifications
  FOR ALL
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "master_manage_plans" ON public.plans;
CREATE POLICY "master_manage_plans"
  ON public.plans
  FOR ALL
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "master_admin_platform" ON public.platform_settings;
CREATE POLICY "master_admin_platform"
  ON public.platform_settings
  FOR ALL
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "master_admin_tenants" ON public.tenants;
CREATE POLICY "master_admin_tenants"
  ON public.tenants
  FOR ALL
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "master_read_tenants" ON public.tenants;
CREATE POLICY "master_read_tenants"
  ON public.tenants
  FOR SELECT
  USING (public.is_master_admin());

-- Post-migration verification queries, comments only:
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
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND policyname IN (
--     'master_insert_audit_logs',
--     'master_view_audit_logs',
--     'master_all_campaigns',
--     'master_admin_agencies',
--     'master_read_agencies',
--     'master_update_commission',
--     'master_read_agency_plans',
--     'master_admin_bookings',
--     'master_admin_branches',
--     'master_admin_invoices',
--     'master_admin_items',
--     'master_admin_messages',
--     'master_all_notifications',
--     'master_manage_plans',
--     'master_admin_platform',
--     'master_admin_tenants',
--     'master_read_tenants'
--   )
-- ORDER BY tablename, policyname;
--
-- Rollback guidance, comments only:
-- Do not restore unsafe metadata or hardcoded-email policies.
-- If rollback is required, create a new reviewed migration that replaces these
-- policies with the last approved trusted authorization model.
