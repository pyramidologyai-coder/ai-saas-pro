-- Upgrades existing profile permission JSON objects to support granular page
-- permissions without discarding existing/custom permission keys.
--
-- Safety:
-- - Adds public.profiles.permissions when missing.
-- - Preserves existing granular keys on rerun.
-- - Parses legacy boolean-like strings defensively so malformed values do not
--   abort the migration.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '{}'::jsonb;

UPDATE public.profiles
SET permissions = COALESCE(permissions, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
  'financial', CASE
    WHEN COALESCE(permissions, '{}'::jsonb) ? 'financial' THEN NULL
    WHEN lower(COALESCE(permissions->>'view_revenue', 'false')) IN ('true', 't', '1', 'yes') THEN to_jsonb(true)
    ELSE to_jsonb(false)
  END,
  'billing', CASE
    WHEN COALESCE(permissions, '{}'::jsonb) ? 'billing' THEN NULL
    WHEN lower(COALESCE(permissions->>'view_revenue', 'false')) IN ('true', 't', '1', 'yes') THEN to_jsonb(true)
    ELSE to_jsonb(false)
  END,
  'automations', CASE
    WHEN COALESCE(permissions, '{}'::jsonb) ? 'automations' THEN NULL
    WHEN lower(COALESCE(permissions->>'manage_settings', 'false')) IN ('true', 't', '1', 'yes') THEN to_jsonb(true)
    ELSE to_jsonb(false)
  END,
  'view_all_bookings', CASE
    WHEN COALESCE(permissions, '{}'::jsonb) ? 'view_all_bookings' THEN NULL
    WHEN lower(COALESCE(permissions->>'view_all_bookings', 'false')) IN ('true', 't', '1', 'yes') THEN to_jsonb(true)
    ELSE to_jsonb(false)
  END,
  'bookings', CASE WHEN COALESCE(permissions, '{}'::jsonb) ? 'bookings' THEN NULL ELSE to_jsonb(true) END,
  'services', CASE WHEN COALESCE(permissions, '{}'::jsonb) ? 'services' THEN NULL ELSE to_jsonb(true) END,
  'customers', CASE WHEN COALESCE(permissions, '{}'::jsonb) ? 'customers' THEN NULL ELSE to_jsonb(true) END,
  'messages', CASE WHEN COALESCE(permissions, '{}'::jsonb) ? 'messages' THEN NULL ELSE to_jsonb(true) END,
  'team', CASE WHEN COALESCE(permissions, '{}'::jsonb) ? 'team' THEN NULL ELSE to_jsonb(true) END,
  'marketing', CASE WHEN COALESCE(permissions, '{}'::jsonb) ? 'marketing' THEN NULL ELSE to_jsonb(true) END,
  'branches', CASE WHEN COALESCE(permissions, '{}'::jsonb) ? 'branches' THEN NULL ELSE to_jsonb(true) END
));
