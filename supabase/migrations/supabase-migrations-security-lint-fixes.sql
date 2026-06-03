-- ========================================================
-- SECURITY LINT FIXES
-- This file contains all the RLS enablement and policy 
-- fixes applied to resolve Supabase Linter warnings.
-- ========================================================

-- 1. Enable RLS on all tables
ALTER TABLE IF EXISTS public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.staff ENABLE ROW LEVEL SECURITY;

-- 2. Secure Policy Updates (Removing insecure user_metadata references)

-- Fix plans table
DROP POLICY IF EXISTS "master_manage_plans" ON public.plans;
CREATE POLICY "master_manage_plans" ON public.plans FOR ALL 
USING (auth.jwt() ->> 'email' IN ('ashsameh1@gmail.com', 'pyramidology.ai@gmail.com'));

-- Fix agency_plans table
DROP POLICY IF EXISTS "master_read_agency_plans" ON public.agency_plans;
CREATE POLICY "master_read_agency_plans" ON public.agency_plans FOR SELECT 
USING (auth.jwt() ->> 'email' IN ('ashsameh1@gmail.com', 'pyramidology.ai@gmail.com'));

-- Fix agencies table reads
DROP POLICY IF EXISTS "master_read_agencies" ON public.agencies;
CREATE POLICY "master_read_agencies" ON public.agencies FOR SELECT 
USING (auth.jwt() ->> 'email' IN ('ashsameh1@gmail.com', 'pyramidology.ai@gmail.com'));

DROP POLICY IF EXISTS "agency_owner_read_own" ON public.agencies;
CREATE POLICY "agency_owner_read_own" ON public.agencies FOR SELECT 
USING (user_id = auth.uid());

-- Fix agencies table updates
DROP POLICY IF EXISTS "master_update_commission" ON public.agencies;
CREATE POLICY "master_update_commission" ON public.agencies FOR UPDATE 
USING (auth.jwt() ->> 'email' IN ('ashsameh1@gmail.com', 'pyramidology.ai@gmail.com'))
WITH CHECK (auth.jwt() ->> 'email' IN ('ashsameh1@gmail.com', 'pyramidology.ai@gmail.com'));

DROP POLICY IF EXISTS "agency_owner_update_own" ON public.agencies;
CREATE POLICY "agency_owner_update_own" ON public.agencies FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Fix tenants table reads
DROP POLICY IF EXISTS "master_read_tenants" ON public.tenants;
CREATE POLICY "master_read_tenants" ON public.tenants FOR SELECT 
USING (auth.jwt() ->> 'email' IN ('ashsameh1@gmail.com', 'pyramidology.ai@gmail.com'));

DROP POLICY IF EXISTS "agency_read_own_tenants" ON public.tenants;
CREATE POLICY "agency_read_own_tenants" ON public.tenants FOR SELECT 
USING (agency_id IN (SELECT id FROM agencies WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_read_own" ON public.tenants;
CREATE POLICY "admin_read_own" ON public.tenants FOR SELECT 
USING (user_id = auth.uid());

-- Fix notifications table
DROP POLICY IF EXISTS "master_all_notifications" ON public.notifications;
CREATE POLICY "master_all_notifications" ON public.notifications FOR ALL 
USING (auth.jwt() ->> 'email' IN ('ashsameh1@gmail.com', 'pyramidology.ai@gmail.com'));
