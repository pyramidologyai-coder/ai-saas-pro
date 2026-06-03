# Supabase Migration History & Phase 0-S Safety Notes

This directory consolidates the project's Supabase SQL files and security remediation migrations.

> **Gatekeeper rule:** Do not run migrations directly against production until the migration order, preflight checks, rollback plan, and environment readiness are approved.

## Historical archive

The previously root-level `supabase*.sql` files were moved into this directory for repository hygiene and auditability. The move-only cleanup was verified by basename and content hash comparison.

## Phase 0-S remediation migrations

The following migrations are remediation files that should be reviewed and applied in this order when database execution is approved:

1. `supabase-migrations-master-rbac-fix.sql`
   - Recreates `verify_master_admin_role()` and `is_master_admin()` using `auth.users.raw_app_meta_data->>'role' = 'master_admin'`.
   - Does **not** create an arbitrary SQL execution helper.
2. `supabase-migrations-dynamic-admin-role.sql`
   - Replaces hardcoded master-admin email RLS policies with `public.is_master_admin()`.
3. `supabase-migrations-api-key-hashing.sql`
   - Adds/backfills `tenants.api_key_hash` and creates a unique partial index for O(1) API key authentication lookups.
   - This should be applied before deploying code paths that query `api_key_hash`.
4. `supabase-migrations-ai-dialect.sql`
   - Adds tenant-level AI dialect/style configuration.
5. `supabase-migrations-migrate-profiles-permissions.sql`
   - Merges granular page permissions into existing `profiles.permissions` JSON without discarding unknown keys.
6. `supabase-migrations-staff-rls-access.sql`
   - Adds idempotent tenant-scoped staff access policies.
   - Read access is limited to users with a matching `profiles.tenant_id`.
   - Write access is limited by `profiles.role = 'admin'` or the matching granular permission key.
7. `supabase-migrations-drop-public-rls.sql`
   - Drops unsafe public cross-tenant read/insert policies.
   - Breaking-change risk: public widgets must use secure server-side routes/actions before this is applied.
8. `supabase-migrations-bookings-fk.sql`
   - Adds `bookings.item_id -> items.id` FK only when `bookings.item_id` exists and the constraint is absent.

## Production preflight checklist

Before applying any migration to production:

- Confirm current table/column existence for `tenants`, `profiles`, `bookings`, `items`, `branches`, `messages`, `agencies`, `platform_settings`, and `invoices`.
- Confirm RLS is enabled on tenant-scoped tables.
- Confirm public widget/customer-facing flows no longer require direct anonymous table reads or inserts before applying `supabase-migrations-drop-public-rls.sql`.
- Confirm a master admin user has trusted app metadata: `raw_app_meta_data.role = 'master_admin'`.
- Confirm existing tenant API keys can be backfilled into `api_key_hash`.
- Take a database backup/snapshot before execution.

## Rollback notes

These files are mostly forward-only hardening migrations. Rollback should be handled with a database backup/snapshot. If an emergency SQL rollback is required, prepare it per environment after inspecting the live policies/functions because blindly recreating permissive public policies can reintroduce cross-tenant vulnerabilities.
