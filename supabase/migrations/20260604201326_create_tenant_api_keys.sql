-- Package E1a migration draft only. Do not apply without explicit approval.
-- External API Key Lifecycle Foundation.
--
-- Scope:
-- - Add dedicated lifecycle tables for tenant API keys and API key events.
-- - Store only derived key material: key_hash and key_prefix.
-- - Do not modify, drop, or backfill public.tenants.api_key or public.tenants.api_key_hash.
-- - Do not mutate existing data.
--
-- Operational note:
-- - Direct client writes are intentionally not allowed by RLS policies here.
-- - Direct anon/authenticated table access is intentionally revoked below so
--   key_hash cannot be exposed through row-level SELECT access.
-- - Future server actions/API routes should create, rotate, revoke, and audit keys
--   through a trusted server-side Supabase client or equivalent privileged path.
-- - Dashboard key listing should be served by server actions/service-role code
--   that omits key_hash from responses rather than by direct client table grants.

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NULL THEN
    RAISE EXCEPTION 'Required table public.tenants does not exist';
  END IF;

  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'Required table public.profiles does not exist';
  END IF;

  IF to_regprocedure('public.is_master_admin()') IS NULL THEN
    RAISE EXCEPTION 'Required helper public.is_master_admin() does not exist';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.tenant_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  name text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NULL,
  revoked_at timestamptz NULL,
  revoked_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  last_used_at timestamptz NULL,
  last_used_ip_hash text NULL,
  last_used_user_agent_hash text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenant_api_keys_status_check
    CHECK (status IN ('active', 'revoked', 'expired', 'disabled')),
  CONSTRAINT tenant_api_keys_name_nonempty_check
    CHECK (length(btrim(name)) > 0),
  CONSTRAINT tenant_api_keys_key_prefix_nonempty_check
    CHECK (length(btrim(key_prefix)) > 0),
  CONSTRAINT tenant_api_keys_key_hash_nonempty_check
    CHECK (length(btrim(key_hash)) > 0),
  CONSTRAINT tenant_api_keys_scopes_nonempty_no_nulls_check
    CHECK (cardinality(scopes) > 0 AND array_position(scopes, NULL) IS NULL),
  CONSTRAINT tenant_api_keys_revoked_status_consistency_check
    CHECK (
      (status = 'revoked' AND revoked_at IS NOT NULL)
      OR (status <> 'revoked' AND revoked_at IS NULL AND revoked_by IS NULL)
    )
);

COMMENT ON TABLE public.tenant_api_keys IS
  'Dedicated tenant API key lifecycle records. Stores key_hash and key_prefix only; never stores raw API keys.';

COMMENT ON COLUMN public.tenant_api_keys.key_hash IS
  'Hash of the full API key. The original secret value must never be stored in this table.';

COMMENT ON COLUMN public.tenant_api_keys.key_prefix IS
  'Non-secret display prefix used for identification, audit trails, and operator support.';

COMMENT ON COLUMN public.tenant_api_keys.scopes IS
  'Allowed API key scopes. At least one non-null scope is required; omitted scopes fail because the compatibility default is empty.';

CREATE TABLE IF NOT EXISTS public.tenant_api_key_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  api_key_id uuid NULL REFERENCES public.tenant_api_keys(id) ON DELETE SET NULL,
  key_prefix text NOT NULL,
  event_type text NOT NULL,
  actor_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_hash text NULL,
  user_agent_hash text NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenant_api_key_events_key_prefix_nonempty_check
    CHECK (length(btrim(key_prefix)) > 0),
  CONSTRAINT tenant_api_key_events_event_type_check
    CHECK (
      event_type IN (
        'created',
        'used',
        'failed_auth',
        'revoked',
        'disabled',
        'expired',
        'rotated',
        'scope_changed',
        'name_changed',
        'legacy_key_used'
      )
    ),
  CONSTRAINT tenant_api_key_events_tenant_required_unless_failed_auth_check
    CHECK (tenant_id IS NOT NULL OR event_type = 'failed_auth'),
  CONSTRAINT tenant_api_key_events_metadata_object_check
    CHECK (jsonb_typeof(metadata) = 'object')
);

COMMENT ON TABLE public.tenant_api_key_events IS
  'Append-only audit events for tenant API key lifecycle and authentication activity. tenant_id may be NULL only for failed_auth events where the key is unknown or invalid.';

COMMENT ON COLUMN public.tenant_api_key_events.key_prefix IS
  'Non-secret key prefix retained even if the API key record is later deleted.';

CREATE UNIQUE INDEX IF NOT EXISTS tenant_api_keys_key_hash_key
  ON public.tenant_api_keys (key_hash);

CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_tenant_id
  ON public.tenant_api_keys (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_active_key_hash_status
  ON public.tenant_api_keys (key_hash, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_tenant_id_status
  ON public.tenant_api_keys (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_expires_at
  ON public.tenant_api_keys (expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_tenant_id_key_prefix
  ON public.tenant_api_keys (tenant_id, key_prefix);

CREATE INDEX IF NOT EXISTS idx_tenant_api_key_events_tenant_id_created_at
  ON public.tenant_api_key_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_api_key_events_api_key_id_created_at
  ON public.tenant_api_key_events (api_key_id, created_at DESC)
  WHERE api_key_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_api_key_events_event_type_created_at
  ON public.tenant_api_key_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_api_key_events_key_prefix_created_at
  ON public.tenant_api_key_events (key_prefix, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_tenant_api_keys_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_tenant_api_keys_updated_at ON public.tenant_api_keys;
CREATE TRIGGER set_tenant_api_keys_updated_at
  BEFORE UPDATE ON public.tenant_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenant_api_keys_updated_at();

ALTER TABLE public.tenant_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_api_key_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.tenant_api_keys FROM anon, authenticated;
REVOKE ALL ON TABLE public.tenant_api_key_events FROM anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_api_keys'
      AND policyname = 'tenant_api_keys_select_authorized'
  ) THEN
    CREATE POLICY tenant_api_keys_select_authorized
      ON public.tenant_api_keys
      FOR SELECT
      USING (
        public.is_master_admin()
        OR EXISTS (
          SELECT 1
          FROM public.tenants t
          WHERE t.id = tenant_api_keys.tenant_id
            AND t.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.tenant_id = tenant_api_keys.tenant_id
            AND p.role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_api_key_events'
      AND policyname = 'tenant_api_key_events_select_authorized'
  ) THEN
    CREATE POLICY tenant_api_key_events_select_authorized
      ON public.tenant_api_key_events
      FOR SELECT
      USING (
        public.is_master_admin()
        OR EXISTS (
          SELECT 1
          FROM public.tenants t
          WHERE t.id = tenant_api_key_events.tenant_id
            AND t.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.tenant_id = tenant_api_key_events.tenant_id
            AND p.role = 'admin'
        )
      );
  END IF;
END
$$;

-- Post-migration verification queries, comments only:
--
-- Confirm tables exist:
-- SELECT table_schema, table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN ('tenant_api_keys', 'tenant_api_key_events')
-- ORDER BY table_name;
--
-- Confirm no raw/plaintext API key column exists on the lifecycle tables:
-- SELECT table_name, column_name
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name IN ('tenant_api_keys', 'tenant_api_key_events')
--   AND column_name ~* '(^|_)api_key($|_)|(^|_)key($|_)|plain|raw|secret';
-- -- Expected sensitive result set: key_hash and key_prefix only.
--
-- Confirm legacy tenant API key columns were not modified by this migration:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'tenants'
--   AND column_name IN ('api_key', 'api_key_hash')
-- ORDER BY column_name;
--
-- Confirm RLS is enabled:
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('tenant_api_keys', 'tenant_api_key_events')
-- ORDER BY tablename;
--
-- Confirm required lifecycle constraints exist:
-- SELECT conrelid::regclass AS table_name, conname
-- FROM pg_constraint
-- WHERE conrelid IN ('public.tenant_api_keys'::regclass, 'public.tenant_api_key_events'::regclass)
--   AND conname IN (
--     'tenant_api_keys_scopes_nonempty_no_nulls_check',
--     'tenant_api_key_events_tenant_required_unless_failed_auth_check'
--   )
-- ORDER BY table_name, conname;
--
-- Confirm SELECT policies use tenant ownership, tenant admin profile, and master admin helper:
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('tenant_api_keys', 'tenant_api_key_events')
-- ORDER BY tablename, policyname;
--
-- Confirm direct client write policies were not created:
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('tenant_api_keys', 'tenant_api_key_events')
--   AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
-- ORDER BY tablename, policyname;
--
-- Confirm anon/authenticated have no direct table or key_hash column privileges:
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.table_privileges
-- WHERE table_schema = 'public'
--   AND table_name IN ('tenant_api_keys', 'tenant_api_key_events')
--   AND grantee IN ('anon', 'authenticated')
-- ORDER BY table_name, grantee, privilege_type;
--
-- SELECT grantee, table_name, column_name, privilege_type
-- FROM information_schema.column_privileges
-- WHERE table_schema = 'public'
--   AND table_name = 'tenant_api_keys'
--   AND column_name = 'key_hash'
--   AND grantee IN ('anon', 'authenticated')
-- ORDER BY grantee, privilege_type;
--
-- Confirm no unsafe user metadata or email-based authorization appears in these policies:
-- SELECT schemaname, tablename, policyname, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('tenant_api_keys', 'tenant_api_key_events')
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
-- Rollback guidance, comments only:
-- 1. Review application dependencies before rollback.
-- 2. If no production code depends on these lifecycle tables, a reviewed rollback
--    migration can drop the trigger, function, tables, and indexes introduced here:
--    DROP TRIGGER IF EXISTS set_tenant_api_keys_updated_at ON public.tenant_api_keys;
--    DROP FUNCTION IF EXISTS public.set_tenant_api_keys_updated_at();
--    DROP TABLE IF EXISTS public.tenant_api_key_events;
--    DROP TABLE IF EXISTS public.tenant_api_keys;
-- 3. Do not alter public.tenants.api_key or public.tenants.api_key_hash as part of rollback.
