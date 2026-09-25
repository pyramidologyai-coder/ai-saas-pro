-- ============================================================================
-- 0043_signup_sectors.sql — signup should only offer public business types.
-- Run AFTER 0042. Safe to re-run.
--
-- WHY
-- /api/signup listed every sector_templates row, unfiltered, so the signup form
-- offered the internal agent types — HR (internal), Payroll (internal), Finance
-- (internal), Business insights (internal) — as business categories. An owner
-- picking one would get an internal agent standing in as their public
-- receptionist. The route already had a hard-coded fallback of the right public
-- sectors, so the intent was clearly public-only; the live query just forgot.
--
-- sector_audience() already knows which sectors are public. This wraps it so the
-- rule stays in one place rather than being re-listed in the route.
-- ============================================================================

create or replace function signup_sectors()
returns json
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(json_agg(json_build_object(
      'sector_id',     sector_id,
      'label',         label,
      'agent_default', agent_default
    ) order by label), '[]'::json)
  from sector_templates
  where sector_audience(sector_id) = 'public';
$$;

revoke execute on function signup_sectors() from public, anon, authenticated;
grant  execute on function signup_sectors() to service_role;

-- ============================================================================
-- CHECK
--   select signup_sectors();
--   → clinic, fitness, general, restaurant, salon, support — and none of the
--     four internal ones.
-- ============================================================================
