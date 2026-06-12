-- Restrict existing RLS policies to signed-in users without changing predicates.

DROP POLICY IF EXISTS "master_admin_bookings" ON public.bookings;
CREATE POLICY "master_admin_bookings"
  ON public.bookings
  FOR ALL
  TO authenticated
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "master_admin_messages" ON public.messages;
CREATE POLICY "master_admin_messages"
  ON public.messages
  FOR ALL
  TO authenticated
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "master_admin_branches" ON public.branches;
CREATE POLICY "master_admin_branches"
  ON public.branches
  FOR ALL
  TO authenticated
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "branches_select_policy" ON public.branches;
CREATE POLICY "branches_select_policy"
  ON public.branches
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "branches_insert_policy" ON public.branches;
CREATE POLICY "branches_insert_policy"
  ON public.branches
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "branches_update_policy" ON public.branches;
CREATE POLICY "branches_update_policy"
  ON public.branches
  FOR UPDATE
  TO authenticated
  USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "branches_delete_policy" ON public.branches;
CREATE POLICY "branches_delete_policy"
  ON public.branches
  FOR DELETE
  TO authenticated
  USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "master_admin_items" ON public.items;
CREATE POLICY "master_admin_items"
  ON public.items
  FOR ALL
  TO authenticated
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "items_select_policy" ON public.items;
CREATE POLICY "items_select_policy"
  ON public.items
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "items_insert_policy" ON public.items;
CREATE POLICY "items_insert_policy"
  ON public.items
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "items_update_policy" ON public.items;
CREATE POLICY "items_update_policy"
  ON public.items
  FOR UPDATE
  TO authenticated
  USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "items_delete_policy" ON public.items;
CREATE POLICY "items_delete_policy"
  ON public.items
  FOR DELETE
  TO authenticated
  USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));
