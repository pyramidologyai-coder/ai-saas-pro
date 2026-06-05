# Supabase Read-only SQL/RLS Preflight

**Product:** Automology.ai — AI SaaS Clinics & Restaurants  
**Date:** 2026-06-05  
**Scope:** Approval Next B — read-only SQL/RLS policy preflight.  
**Restrictions followed:** No DB writes, no migrations, no schema changes, no env changes, no push, no deploy.

---

## 1. Gatekeeper Status

**Result:** Partially completed / blocked on direct SQL execution access.

Hermes verified available access paths:

- Supabase CLI: not installed / not available in shell.
- Supabase Management token / project DB URL: not found in local env files.
- Direct Postgres connection string: not found.
- Supabase REST/OpenAPI access: available and already used for read-only metadata/table checks.
- Supabase project metadata file present: `supabase/.temp/linked-project.json`.

Because direct SQL access was not available, Hermes did **not** execute `pg_catalog` / `pg_policies` / `pg_class` SQL queries. Therefore, RLS policy definitions remain **not directly verified**.

---

## 2. Verified Without SQL Writes

From previous read-only REST/OpenAPI preflight:

- `tenant_api_keys` exists in live REST schema.
- `tenant_api_key_events` exists in live REST schema.
- Core tables are exposed through REST/OpenAPI: `tenants`, `profiles`, `agencies`, `bookings`, `messages`, `conversations`, `branches`, `items`, `audit_logs`, `plans`, `plan_features`, `invoices`, `wallet_ledger`, `platform_settings`.
- RPC metadata includes `verify_master_admin_role`, `is_master_admin`, and `get_channel_analytics`.
- Live schema issue remains: `tenants.subscription_status` is missing.

---

## 3. Local Migration-derived RLS Targets

Hermes parsed migration files locally and found these intended RLS-enabled tables:

- `agencies`
- `agency_plans`
- `audit_logs`
- `bookings`
- `bot_templates`
- `branches`
- `chat_messages`
- `conversations`
- `invoices`
- `items`
- `messages`
- `notifications`
- `plans`
- `platform_settings`
- `profiles`
- `tenant_api_key_events`
- `tenant_api_keys`
- `tenants`
- `wallet_ledger`
- `whatsapp_templates`

Migration-derived important functions:

- `verify_master_admin_role`
- `is_master_admin`
- `get_channel_analytics`
- `set_tenant_api_keys_updated_at`
- `handle_new_user_tenant`
- `protect_billing_fields`
- `prevent_financial_tampering`
- `prevent_audit_tampering`
- `prevent_double_booking`
- `prevent_status_tampering`
- `increment_message_usage`

Migration-derived critical policies include:

- `tenant_api_keys::tenant_api_keys_select_authorized`
- `tenant_api_key_events::tenant_api_key_events_select_authorized`
- `tenants::master_admin_tenants`
- `tenants::master_read_tenants`
- `tenants::tenant_owner_access`
- `tenants::agency_tenants_access`
- `agencies::master_admin_agencies`
- `agencies::master_read_agencies`
- `bookings::tenant_bookings_access`
- `bookings::staff_bookings_select`
- `bookings::staff_bookings_insert`
- `bookings::staff_bookings_update`
- `bookings::staff_bookings_delete`
- `items::tenant_items_access`
- `items::staff_items_select`
- `messages::tenant_messages_access`
- `messages::public_insert_messages`
- `branches::tenant_branches_access`
- `profiles::Users can view their own profile`
- `profiles::Admins can view all profiles in their tenant`
- `wallet_ledger::no_client_inserts`
- `wallet_ledger::no_client_updates`
- `wallet_ledger::no_client_deletes`

---

## 4. SQL Pack for Ahmad to Run in Supabase SQL Editor

Run these manually in Supabase SQL Editor. They are read-only `select` queries only.

### 4.1 RLS enabled state

```sql
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'agencies','agency_plans','audit_logs','bookings','bot_templates','branches',
    'chat_messages','conversations','invoices','items','messages','notifications',
    'plans','platform_settings','profiles','tenant_api_key_events','tenant_api_keys',
    'tenants','wallet_ledger','whatsapp_templates'
  )
order by c.relname;
```

### 4.2 Policy inventory

```sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'agencies','agency_plans','audit_logs','bookings','bot_templates','branches',
    'chat_messages','conversations','invoices','items','messages','notifications',
    'plans','platform_settings','profiles','tenant_api_key_events','tenant_api_keys',
    'tenants','wallet_ledger','whatsapp_templates'
  )
order by tablename, policyname;
```

### 4.3 Critical function inventory

```sql
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_result(p.oid) as returns,
  pg_get_function_arguments(p.oid) as arguments,
  l.lanname as language,
  p.prosecdef as security_definer,
  p.provolatile as volatility
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
  and p.proname in (
    'verify_master_admin_role','is_master_admin','get_channel_analytics',
    'set_tenant_api_keys_updated_at','handle_new_user_tenant','protect_billing_fields',
    'prevent_financial_tampering','prevent_audit_tampering','prevent_double_booking',
    'prevent_status_tampering','increment_message_usage'
  )
order by p.proname;
```

### 4.4 Trigger inventory

```sql
select
  event_object_schema,
  event_object_table,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
order by event_object_table, trigger_name, event_manipulation;
```

### 4.5 Critical column existence

```sql
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('tenants','profiles','tenant_api_keys','tenant_api_key_events','bookings','messages','items','branches','agencies')
order by table_name, ordinal_position;
```

### 4.6 Migration history, if `supabase_migrations.schema_migrations` exists

```sql
select version, name, statements
from supabase_migrations.schema_migrations
order by version desc
limit 50;
```

If `statements` does not exist in your project history table, run:

```sql
select *
from supabase_migrations.schema_migrations
order by version desc
limit 50;
```

### 4.7 Master admin metadata presence without exposing all users

Replace the email manually in Supabase SQL Editor if needed. Do not paste user IDs into chat unless redacted.

```sql
select
  id,
  email,
  raw_app_meta_data ->> 'role' as app_role,
  raw_user_meta_data ->> 'role' as user_meta_role,
  created_at,
  last_sign_in_at
from auth.users
where raw_app_meta_data ->> 'role' in ('master_admin','super_admin')
   or email = '<YOUR_MASTER_ADMIN_EMAIL>'
order by created_at desc;
```

---

## 5. What Hermes Needs From Ahmad

Paste back query results with sensitive values redacted. Required minimum:

1. RLS enabled state output.
2. Policy inventory output.
3. Critical function inventory output.
4. Critical columns output.
5. Migration history output.
6. Master admin metadata presence output, redacting user IDs if desired.

---

## 6. Gatekeeper Decision

**Do not run migrations yet.**

Direct RLS policy verification is still blocked until the SQL pack above is executed in Supabase SQL Editor or direct read-only SQL access is provided.
