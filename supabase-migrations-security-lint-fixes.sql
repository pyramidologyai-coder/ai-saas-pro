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
DROP POLICY IF EXISTS "master_manage_plans" ON public.plans;
CREATE POLICY "master_manage_plans" ON public.plans FOR ALL 
USING (auth.jwt() ->> 'email' IN ('ashsameh1@gmail.com', 'pyramidology.ai@gmail.com'));

DROP POLICY IF EXISTS "master_read_agency_plans" ON public.agency_plans;
CREATE POLICY "master_read_agency_plans" ON public.agency_plans FOR SELECT 
USING (auth.jwt() ->> 'email' IN ('ashsameh1@gmail.com', 'pyramidology.ai@gmail.com'));

DROP POLICY IF EXISTS "master_read_agencies" ON public.agencies;
CREATE POLICY "master_read_agencies" ON public.agencies FOR SELECT 
USING (auth.jwt() ->> 'email' IN ('ashsameh1@gmail.com', 'pyramidology.ai@gmail.com'));

DROP POLICY IF EXISTS "agency_owner_read_own" ON public.agencies;
CREATE POLICY "agency_owner_read_own" ON public.agencies FOR SELECT 
USING (user_id = auth.uid());
