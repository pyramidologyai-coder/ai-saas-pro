-- ========================================================
-- DROP UNSAFE PUBLIC RLS POLICIES (Fix #1 & #2 cleanup)
-- ========================================================
-- Removes unauthenticated cross-tenant SELECT/INSERT policies. Public widget
-- and website flows must use server-side Next.js routes/actions that validate
-- tenant context, rate limits, and input payloads before writing through a
-- trusted server client.

DROP POLICY IF EXISTS public_read_items ON public.items;
DROP POLICY IF EXISTS public_read_branches ON public.branches;
DROP POLICY IF EXISTS public_insert_bookings ON public.bookings;
DROP POLICY IF EXISTS public_insert_messages ON public.messages;
