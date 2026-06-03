-- ========================================================
-- MISSING RLS POLICIES FOR TEAM MEMBERS AND BRANCHES
-- Allows owners to insert/update/delete their own data
-- ========================================================

-- Policies for team_members
DROP POLICY IF EXISTS "team_select_policy" ON public.team_members;
CREATE POLICY "team_select_policy" ON public.team_members FOR SELECT USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "team_insert_policy" ON public.team_members;
CREATE POLICY "team_insert_policy" ON public.team_members FOR INSERT WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "team_update_policy" ON public.team_members;
CREATE POLICY "team_update_policy" ON public.team_members FOR UPDATE USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())) WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "team_delete_policy" ON public.team_members;
CREATE POLICY "team_delete_policy" ON public.team_members FOR DELETE USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

-- Policies for branches
DROP POLICY IF EXISTS "branches_select_policy" ON public.branches;
CREATE POLICY "branches_select_policy" ON public.branches FOR SELECT USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "branches_insert_policy" ON public.branches;
CREATE POLICY "branches_insert_policy" ON public.branches FOR INSERT WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "branches_update_policy" ON public.branches;
CREATE POLICY "branches_update_policy" ON public.branches FOR UPDATE USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())) WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "branches_delete_policy" ON public.branches;
CREATE POLICY "branches_delete_policy" ON public.branches FOR DELETE USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));
