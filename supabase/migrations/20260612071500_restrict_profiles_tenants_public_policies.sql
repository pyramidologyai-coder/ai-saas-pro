-- LOCAL-ONLY PROPOSAL: Restrict remaining profiles/tenants policies to signed-in users.
-- Predicates are preserved from the live pg_policies catalog inspected on 2026-06-12.

DROP POLICY IF EXISTS "Owners can delete their tenant's profiles" ON public.profiles;
CREATE POLICY "Owners can delete their tenant's profiles"
  ON public.profiles FOR DELETE TO authenticated
  USING ((tenant_id IN ( SELECT tenants.id
   FROM tenants
  WHERE (tenants.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Owners can insert profiles to their tenant" ON public.profiles;
CREATE POLICY "Owners can insert profiles to their tenant"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((tenant_id IN ( SELECT tenants.id
   FROM tenants
  WHERE (tenants.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Owners can update their tenant's profiles" ON public.profiles;
CREATE POLICY "Owners can update their tenant's profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING ((tenant_id IN ( SELECT tenants.id
   FROM tenants
  WHERE (tenants.user_id = auth.uid()))))
  WITH CHECK ((tenant_id IN ( SELECT tenants.id
   FROM tenants
  WHERE (tenants.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Owners can view all profiles in their tenant" ON public.profiles;
CREATE POLICY "Owners can view all profiles in their tenant"
  ON public.profiles FOR SELECT TO authenticated
  USING ((tenant_id IN ( SELECT tenants.id
   FROM tenants
  WHERE (tenants.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Owners can view their tenant's profiles" ON public.profiles;
CREATE POLICY "Owners can view their tenant's profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING ((tenant_id IN ( SELECT tenants.id
   FROM tenants
  WHERE (tenants.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING ((auth.uid() = id));

DROP POLICY IF EXISTS "owners_select_tenant_profiles" ON public.profiles;
CREATE POLICY "owners_select_tenant_profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING ((tenant_id = get_auth_owned_tenant_id()));

DROP POLICY IF EXISTS "admin_read_own" ON public.tenants;
CREATE POLICY "admin_read_own"
  ON public.tenants FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS "agency_read_own_tenants" ON public.tenants;
CREATE POLICY "agency_read_own_tenants"
  ON public.tenants FOR SELECT TO authenticated
  USING ((agency_id IN ( SELECT agencies.id
   FROM agencies
  WHERE (agencies.user_id = auth.uid()))));

DROP POLICY IF EXISTS "agency_tenants_access" ON public.tenants;
CREATE POLICY "agency_tenants_access"
  ON public.tenants FOR SELECT TO authenticated
  USING ((agency_id IN ( SELECT agencies.id
   FROM agencies
  WHERE (agencies.user_id = auth.uid()))));

DROP POLICY IF EXISTS "allow_tenant_inserts" ON public.tenants;
CREATE POLICY "allow_tenant_inserts"
  ON public.tenants FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "allow_tenant_updates" ON public.tenants;
CREATE POLICY "allow_tenant_updates"
  ON public.tenants FOR UPDATE TO authenticated
  USING (((auth.uid() = user_id) OR (agency_id IN ( SELECT agencies.id
   FROM agencies
  WHERE (agencies.user_id = auth.uid())))))
  WITH CHECK (((auth.uid() = user_id) OR (agency_id IN ( SELECT agencies.id
   FROM agencies
  WHERE (agencies.user_id = auth.uid())))));

DROP POLICY IF EXISTS "employees_select_own_tenant" ON public.tenants;
CREATE POLICY "employees_select_own_tenant"
  ON public.tenants FOR SELECT TO authenticated
  USING ((id = get_auth_profile_tenant_id()));

DROP POLICY IF EXISTS "master_admin_tenants" ON public.tenants;
CREATE POLICY "master_admin_tenants"
  ON public.tenants FOR ALL TO authenticated
  USING (is_master_admin())
  WITH CHECK (is_master_admin());

DROP POLICY IF EXISTS "master_read_tenants" ON public.tenants;
CREATE POLICY "master_read_tenants"
  ON public.tenants FOR SELECT TO authenticated
  USING (is_master_admin());

DROP POLICY IF EXISTS "no_deletes" ON public.tenants;
CREATE POLICY "no_deletes"
  ON public.tenants FOR DELETE TO authenticated
  USING (false);
