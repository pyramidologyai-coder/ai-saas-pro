# Automology.ai Tenant Isolation Audit

**Product:** AI SaaS Clinics & Restaurants  
**Scope:** Auth, RBAC, RLS, tenant isolation, public widget access, API-key authentication, and migration readiness.  
**Current status:** Phase 0-S remediation files committed; production database migrations not executed.

---

## Executive Summary

The audit identified several high-impact tenant-isolation and authorization risks. Phase 0-R and Phase 0-S addressed the repository and code-level foundations:

- Dashboard/admin routes are now protected by `src/proxy.ts` middleware.
- Tenant API-key authentication now has a reviewed migration path for `tenants.api_key_hash`.
- Unsafe public RLS policies now have a reviewed migration path for removal.
- Hardcoded master-admin email checks now have a reviewed migration path to metadata-backed role functions.
- Staff/employee RLS now has a reviewed migration path using tenant and granular permission checks.

No Supabase migrations have been run from this audit. Database execution still requires explicit approval and a production preflight.

---

## Findings and Current Remediation Status

### Finding 1: Unsafe public SELECT policies on tenant tables

**Severity:** High  
**Affected policies:** `public_read_items`, `public_read_branches`  
**Risk:** Anonymous clients could read records across tenants if direct Supabase access is available and queries are not tenant-scoped.

**Repository remediation:**

- Reviewed migration added: `supabase/migrations/supabase-migrations-drop-public-rls.sql`
- The migration drops the unsafe public read policies.

**Deployment warning:** This is a breaking database change if any public widget still reads directly from Supabase tables. Public widget reads must go through secure server-side routes/actions before applying this migration.

---

### Finding 2: Unsafe public INSERT policies for bookings/messages

**Severity:** High  
**Affected policies:** `public_insert_bookings`, `public_insert_messages`  
**Risk:** Anonymous clients could spam or forge records for guessed tenant IDs.

**Repository remediation:**

- Reviewed migration added: `supabase/migrations/supabase-migrations-drop-public-rls.sql`
- The migration drops public insert policies.

**Deployment warning:** Customer-facing booking/message creation must use validated server-side endpoints/actions before this migration is applied.

---

### Finding 3: Hardcoded master-admin email checks

**Severity:** Medium  
**Risk:** Admin access was coupled to static email values, creating operational and security maintenance risk.

**Repository remediation:**

- Reviewed migration added: `supabase/migrations/supabase-migrations-master-rbac-fix.sql`
- Reviewed migration added: `supabase/migrations/supabase-migrations-dynamic-admin-role.sql`

The remediation uses trusted Supabase app metadata:

```sql
raw_app_meta_data->>'role' = 'master_admin'
```

The migration intentionally does **not** create an arbitrary SQL execution helper.

---

### Finding 4: Inefficient and risky API-key authentication

**Severity:** Medium / High for scale  
**Affected code:** `src/app/api/v1/bookings/route.ts`  
**Risk:** Loading plaintext API keys or relying on plaintext comparisons is not scalable or desirable.

**Repository remediation:**

- Code now queries `tenants.api_key_hash`.
- Reviewed migration added: `supabase/migrations/supabase-migrations-api-key-hashing.sql`

**Deployment warning:** The `api_key_hash` migration must be applied before deploying code paths that depend on that column in production.

---

### Finding 5: Dashboard/admin route exposure risk

**Severity:** High  
**Affected code:** `src/proxy.ts`

**Repository remediation:** Completed in Phase 0-R.

Key protections now include:

- `supabase.auth.getUser()` for protected-route auth.
- Explicit protected route list for dashboard/admin areas.
- `/master-admin/*` requires `verify_master_admin_role()`.
- `/agency-admin/*` requires agency ownership by authenticated user ID.
- Relative-only auth redirects.
- Supabase cookie preservation on redirects/rewrites.
- `/api/*` excluded from tenant-domain rewrites.

---

### Finding 6: Staff/employee tenant access gaps

**Severity:** Medium / High depending on role usage  
**Risk:** Staff users need tenant-scoped operational access, but broad `FOR ALL` policies can overgrant write/delete permissions.

**Repository remediation:**

- Reviewed migration added: `supabase/migrations/supabase-migrations-staff-rls-access.sql`
- Read policies require matching `profiles.tenant_id`.
- Write policies require `profiles.role = 'admin'` or matching granular permission keys.
- Delete policies are admin-only.

---

### Finding 7: Granular permissions migration safety

**Severity:** Medium  
**Risk:** A naive permissions migration can overwrite existing custom permissions or fail if the column does not exist.

**Repository remediation:**

- Reviewed migration added: `supabase/migrations/supabase-migrations-migrate-profiles-permissions.sql`
- Adds `profiles.permissions` if missing.
- Preserves existing/custom permission keys.
- Uses defensive legacy boolean parsing.

---

## Verified Secure/Improved Areas

- `src/proxy.ts` now provides middleware-level dashboard protection.
- API routes remain excluded from tenant custom-domain rewrites.
- Supabase auth cookies are preserved in middleware responses.
- The reviewed master-admin migrations avoid arbitrary SQL execution helpers.
- The reviewed migration README documents execution order, preflight checks, and rollback expectations.

---

## Remaining Gatekeeper Blocks

The following are still blocked until explicit approval:

- Running Supabase migrations.
- Touching production database.
- Deploying to production.
- Applying public RLS removal before widget/server-route readiness is confirmed.
- Treating AI features as production-ready while `GEMINI_API_KEY` is missing in the build environment.

---

## Required Production Preflight

Before database execution:

1. Confirm a current backup/snapshot exists.
2. Confirm master admin users have `raw_app_meta_data.role = 'master_admin'`.
3. Confirm `api_key_hash` can be backfilled for existing tenant API keys.
4. Confirm customer-facing booking/message/widget flows no longer depend on direct anonymous table reads/inserts.
5. Confirm RLS is enabled on tenant-scoped tables.
6. Apply migrations in the order documented in `supabase/migrations/README.md`.
7. Verify application build and smoke-test auth, dashboard, booking, staff, and public widget flows after migration.

---

## Current Recommendation

Proceed with the next phase as a controlled MVP completion audit:

1. Verify production environment variables without exposing values.
2. Verify public widget/customer booking flows are server-routed before public RLS removal.
3. Prepare Supabase migration execution plan and rollback checklist.
4. Only then request Ahmad's final approval for database migration execution and deployment.
