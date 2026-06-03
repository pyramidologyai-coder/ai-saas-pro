-- ========================================================
-- API KEY HASHING MIGRATION (Fix #4)
-- ========================================================
-- Adds a SHA-256 hash column for tenant API keys so API routes can perform
-- indexed lookups without loading plaintext keys for every tenant into memory.
--
-- Safety notes:
-- - Plaintext tenants.api_key is retained for backward compatibility.
-- - Existing keys are backfilled once.
-- - The unique partial index prevents duplicate active hashes while allowing NULL.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS api_key_hash text;

UPDATE public.tenants
SET api_key_hash = encode(digest(api_key, 'sha256'), 'hex')
WHERE api_key IS NOT NULL
  AND api_key_hash IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_api_key_hash
  ON public.tenants (api_key_hash)
  WHERE api_key_hash IS NOT NULL;

COMMENT ON COLUMN public.tenants.api_key_hash IS
  'SHA-256 hash of tenants.api_key for indexed API authentication lookups.';
