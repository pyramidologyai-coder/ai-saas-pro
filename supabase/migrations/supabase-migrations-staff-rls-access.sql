-- ========================================================
-- STAFF/EMPLOYEE RLS ACCESS POLICIES (Fix #7)
-- ========================================================
-- Allows staff members, doctors, and employees to access operational data for
-- their own tenant, while write access remains permission/role scoped.
-- PostgreSQL combines multiple permissive policies with OR, so these stack with
-- existing owner/admin policies.

-- Bookings: tenant members can read; admins or users with bookings permission can write.
DROP POLICY IF EXISTS staff_bookings_select ON public.bookings;
DROP POLICY IF EXISTS staff_bookings_insert ON public.bookings;
DROP POLICY IF EXISTS staff_bookings_update ON public.bookings;
DROP POLICY IF EXISTS staff_bookings_delete ON public.bookings;
DROP POLICY IF EXISTS staff_bookings_access ON public.bookings;

CREATE POLICY staff_bookings_select ON public.bookings
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = bookings.tenant_id
      AND p.role IN ('admin', 'staff', 'doctor')
  ));

CREATE POLICY staff_bookings_insert ON public.bookings
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = bookings.tenant_id
      AND (p.role = 'admin' OR lower(COALESCE(p.permissions->>'bookings', 'false')) IN ('true', 't', '1', 'yes'))
  ));

CREATE POLICY staff_bookings_update ON public.bookings
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = bookings.tenant_id
      AND (p.role = 'admin' OR lower(COALESCE(p.permissions->>'bookings', 'false')) IN ('true', 't', '1', 'yes'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = bookings.tenant_id
      AND (p.role = 'admin' OR lower(COALESCE(p.permissions->>'bookings', 'false')) IN ('true', 't', '1', 'yes'))
  ));

CREATE POLICY staff_bookings_delete ON public.bookings
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = bookings.tenant_id
      AND p.role = 'admin'
  ));

-- Items/services: tenant members can read; admins or services permission can write.
DROP POLICY IF EXISTS staff_items_select ON public.items;
DROP POLICY IF EXISTS staff_items_insert ON public.items;
DROP POLICY IF EXISTS staff_items_update ON public.items;
DROP POLICY IF EXISTS staff_items_delete ON public.items;
DROP POLICY IF EXISTS staff_items_access ON public.items;

CREATE POLICY staff_items_select ON public.items
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = items.tenant_id
      AND p.role IN ('admin', 'staff', 'doctor')
  ));

CREATE POLICY staff_items_insert ON public.items
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = items.tenant_id
      AND (p.role = 'admin' OR lower(COALESCE(p.permissions->>'services', 'false')) IN ('true', 't', '1', 'yes'))
  ));

CREATE POLICY staff_items_update ON public.items
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = items.tenant_id
      AND (p.role = 'admin' OR lower(COALESCE(p.permissions->>'services', 'false')) IN ('true', 't', '1', 'yes'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = items.tenant_id
      AND (p.role = 'admin' OR lower(COALESCE(p.permissions->>'services', 'false')) IN ('true', 't', '1', 'yes'))
  ));

CREATE POLICY staff_items_delete ON public.items
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = items.tenant_id
      AND p.role = 'admin'
  ));

-- Branches: tenant members can read; admins or branches permission can write.
DROP POLICY IF EXISTS staff_branches_select ON public.branches;
DROP POLICY IF EXISTS staff_branches_insert ON public.branches;
DROP POLICY IF EXISTS staff_branches_update ON public.branches;
DROP POLICY IF EXISTS staff_branches_delete ON public.branches;
DROP POLICY IF EXISTS staff_branches_access ON public.branches;

CREATE POLICY staff_branches_select ON public.branches
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = branches.tenant_id
      AND p.role IN ('admin', 'staff', 'doctor')
  ));

CREATE POLICY staff_branches_insert ON public.branches
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = branches.tenant_id
      AND (p.role = 'admin' OR lower(COALESCE(p.permissions->>'branches', 'false')) IN ('true', 't', '1', 'yes'))
  ));

CREATE POLICY staff_branches_update ON public.branches
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = branches.tenant_id
      AND (p.role = 'admin' OR lower(COALESCE(p.permissions->>'branches', 'false')) IN ('true', 't', '1', 'yes'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = branches.tenant_id
      AND (p.role = 'admin' OR lower(COALESCE(p.permissions->>'branches', 'false')) IN ('true', 't', '1', 'yes'))
  ));

CREATE POLICY staff_branches_delete ON public.branches
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = branches.tenant_id
      AND p.role = 'admin'
  ));

-- Messages: tenant members can read; admins or messages permission can write.
DROP POLICY IF EXISTS staff_messages_select ON public.messages;
DROP POLICY IF EXISTS staff_messages_insert ON public.messages;
DROP POLICY IF EXISTS staff_messages_update ON public.messages;
DROP POLICY IF EXISTS staff_messages_delete ON public.messages;
DROP POLICY IF EXISTS staff_messages_access ON public.messages;

CREATE POLICY staff_messages_select ON public.messages
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = messages.tenant_id
      AND p.role IN ('admin', 'staff', 'doctor')
  ));

CREATE POLICY staff_messages_insert ON public.messages
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = messages.tenant_id
      AND (p.role = 'admin' OR lower(COALESCE(p.permissions->>'messages', 'false')) IN ('true', 't', '1', 'yes'))
  ));

CREATE POLICY staff_messages_update ON public.messages
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = messages.tenant_id
      AND (p.role = 'admin' OR lower(COALESCE(p.permissions->>'messages', 'false')) IN ('true', 't', '1', 'yes'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = messages.tenant_id
      AND (p.role = 'admin' OR lower(COALESCE(p.permissions->>'messages', 'false')) IN ('true', 't', '1', 'yes'))
  ));

CREATE POLICY staff_messages_delete ON public.messages
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = messages.tenant_id
      AND p.role = 'admin'
  ));
