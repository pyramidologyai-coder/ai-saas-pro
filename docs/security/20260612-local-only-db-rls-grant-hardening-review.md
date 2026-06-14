# Local-Only DB/RLS Grant Hardening Review v2.2

Status: **LOCAL-ONLY DRAFT - NOT APPLIED**

Migration: `supabase/migrations/20260612120000_local_only_db_rls_grant_hardening_draft.sql`

Required prerequisite migration:
`supabase/migrations/20260612121000_local_only_is_master_admin_search_path_prerequisite.sql`

This package requires Hermes review and separate explicit approval before any
staging apply. It is not approved for production.

## 1. Analysis

The verified SELECT-only live inventory is the source of truth:

- 45 live `SECURITY DEFINER` functions: 42 in `public`, one in `pgbouncer`,
  and two in `vault`.
- 13 `public` functions have `proconfig IS NULL` and no fixed `search_path`.
- 38 functions are executable by `anon`.
- 29 functions are executable by `PUBLIC`.
- 39 permissive RLS policies target `{public}`.
- 126 dangerous table privilege rows grant `TRUNCATE`, `REFERENCES`, or
  `TRIGGER` to `anon`/`authenticated` across 21 `public` tables.
- V2.1 used `information_schema.role_table_grants` and direct
  `anon`/`authenticated` revocation. That could miss direct `PUBLIC` grants and
  dangerous privileges effective through inherited roles.
- `public.get_agency_commission(uuid)` has no live authorization/ownership
  check and permits arbitrary agency commission disclosure.

Exact local bodies were found for only three of the 13 missing-search-path
functions: `get_channel_analytics(integer)`, `is_master_admin()`, and
`verify_master_admin_role()`. V2.2 does not replace those bodies because local
definitions do not prove exact live-body equality. The remaining 12
missing-search-path bodies are not guessed.

V2.2 preserves the v2.1 protections and adds fail-closed migration assertions:

- All expected 42 `public` `SECURITY DEFINER` signatures must resolve.
- No unexpected `public` `SECURITY DEFINER` signature may exist.
- `public.is_master_admin()` must be `SECURITY DEFINER` with an approved fixed
  `search_path`; its exact live definition/configuration must also be captured
  and approved before staging.
- The separate local-only prerequisite draft preserves the verified live
  `is_master_admin()` body and grants while adding
  `SET search_path = pg_catalog, public`. It must pass Hermes review and be
  approved/applied before v2.2 so the v2.2 preflight can pass.
- Its preflight and postflight pair whitespace-insensitive structural checks
  with exact critical authorization-literal and signal checks, so whitespace
  changes inside `'role'` or `'master_admin'` fail closed.
- `get_agency_commission(uuid)` treats NULL from `is_master_admin()` as denial.
- Preflight blocks inherited dangerous grants to roles inherited by `anon` or
  `authenticated`; role membership is never silently changed.
- Direct `TRUNCATE`, `REFERENCES`, and `TRIGGER` grants are revoked from
  `PUBLIC`, `anon`, and `authenticated` on all public base/partitioned tables.
- An in-transaction post-revocation assertion checks direct ACLs, effective
  `anon`/`authenticated` access via `has_table_privilege`, and remaining
  `information_schema.role_table_grants` rows. Any finding rolls back apply.
  Because `PUBLIC` is a pseudo-role rather than a login role, its effective
  table access is detected directly from ACL entries where `grantee = 0`.

## 2. Risks

- Applying v2.2 can intentionally break privileged client workflows assigned
  `service_only` until exact live-body authorization is reviewed.
- After the required `is_master_admin()` prerequisite and the v2.2 commission
  replacement, 11 unresolved missing-search-path functions remain vulnerable;
  grant reduction limits but does not remove that risk.
- The migration intentionally blocks until `is_master_admin()` has an approved
  fixed search path. The separate prerequisite draft supplies that change, but
  neither prerequisite nor v2.2 is approved for staging or production apply.
- `get_channel_analytics(integer)`, `get_unique_customers_count(uuid)`,
  dashboard/calculation RPCs, `is_master_admin()`,
  `verify_master_admin_role()`, and `get_wallet_transactions(...)` are
  `service_only`. This may break staging client/RLS flows, but avoids claiming
  authenticated safety without exact live-body and role-behavior evidence.
- The 39 `{public}` RLS policies are not changed. Guessing policy rewrites could
  break tenant isolation or application access.
- Signature drift stops the migration before body/grant changes.
- Inherited dangerous privileges stop the migration before mutations. Effective
  privileges not explained by direct ACL rows stop and roll back the migration
  after revocation, requiring separate role/ownership investigation.

## 3. Recommendation

Approve the prerequisite and v2.2 for Hermes review only. Before staging apply,
capture exact function
definitions, owners, configurations, ACLs/effective grants, and table privilege
rows, including direct `PUBLIC` ACLs, inherited/effective dangerous privileges,
and an explicit `is_master_admin()` body/search-path snapshot.
Review and separately approve/apply the prerequisite migration before v2.2.
After staging apply, reconcile
service-only breakage, prove retained authenticated functions authorize
correctly, and prepare a separate evidence-backed search-path/RLS-policy phase.

## 4. Implementation Plan

1. Hermes reviews this package and every disposition below.
2. Capture an exact pre-apply staging snapshot for rollback and compare the
   live 42-signature inventory to the expected manifest.
3. Capture and approve the exact `is_master_admin()` live body, owner,
   `proconfig`, search path, ACL, and effective grants.
4. Hermes reviews the body-preserving `is_master_admin()` prerequisite; Ahmad
   separately approves applying it in staging before v2.2.
5. Ahmad separately approves a staging DB-write window.
6. Apply v2.2 in staging only.
7. Run the post-apply SELECT verification and role-based behavior tests.
8. Review all 13 missing-search-path live bodies and fix them in a separate
   approved migration without guessing.
9. Review all 39 `{public}` policies in a separate approved migration.
10. Obtain separate production approval only after blockers are closed.

## 5. Files Affected

- `supabase/migrations/20260612120000_local_only_db_rls_grant_hardening_draft.sql`
- `supabase/migrations/20260612121000_local_only_is_master_admin_search_path_prerequisite.sql`
- `docs/security/20260612-local-only-db-rls-grant-hardening-review.md`

No environment, secret, application, schema, storage, edge-function, or
deployment files are changed.

## 6. Exact Function Disposition: All 45 Live Signatures

`authenticated_service` means revoke `PUBLIC`/`anon` and grant
`authenticated`/`service_role`. `service_only` means revoke
`PUBLIC`/`anon`/`authenticated` and grant `service_role`. `unchanged` means v2
does not alter the function.

| # | Exact live signature | V2.2 disposition | Review note |
|---:|---|---|---|
| 1 | `pgbouncer.get_auth(p_usename text)` | unchanged | Explicitly excluded |
| 2 | `public.activate_agency_cascade(p_agency_id uuid)` | service_only | Privileged mutation; live-body review blocker |
| 3 | `public.add_plan(p_name text, p_slug text, p_price_monthly numeric, p_price_yearly numeric, p_messages_limit integer, p_voice_minutes_limit numeric, p_commission_rate numeric, p_intended_for text, p_reminder_enabled boolean, p_voice_reminder_enabled boolean, p_reminder_credits integer)` | service_only | Privileged mutation; live-body review blocker |
| 4 | `public.add_plan(p_name text, p_slug text, p_price_monthly numeric, p_price_yearly numeric, p_messages_limit integer, p_voice_minutes_limit numeric, p_commission_rate numeric, p_intended_for text, p_reminder_enabled boolean, p_voice_reminder_enabled boolean, p_reminder_credits integer, p_expires_at timestamp with time zone)` | service_only | Privileged mutation; live-body review blocker |
| 5 | `public.add_wallet_credit(p_agency_id uuid, p_amount numeric, p_description text)` | service_only | Existing server service-role call |
| 6 | `public.archive_plan(p_plan_id uuid)` | service_only | Privileged mutation; live-body review blocker |
| 7 | `public.calculate_master_revenue()` | service_only | Dashboard calculation; exact live-body/admin denial evidence required |
| 8 | `public.calculate_usage_rate()` | service_only | Dashboard calculation; exact live-body/admin denial evidence required |
| 9 | `public.check_campaign_rate_limit()` | service_only | Missing search path; trigger/helper blocker |
| 10 | `public.check_tenant_limit()` | service_only | Missing search path; trigger/helper blocker |
| 11 | `public.count_high_usage_tenants()` | service_only | Dashboard calculation; exact live-body/admin denial evidence required |
| 12 | `public.count_today_messages()` | service_only | Dashboard calculation; exact live-body/admin denial evidence required |
| 13 | `public.create_agency(p_name text, p_contact_email text, p_whatsapp_number text, p_commission_rate numeric, p_plan_type text)` | service_only | Privileged mutation; live-body review blocker |
| 14 | `public.delete_plan(p_plan_id uuid)` | service_only | Privileged mutation; live-body review blocker |
| 15 | `public.get_agency_commission(p_agency_id uuid)` | authenticated_service | Body replaced with master-admin check and fixed path |
| 16 | `public.get_agency_wallet_balance(p_agency_id uuid)` | service_only | Parameter authorization not proven |
| 17 | `public.get_auth_owned_tenant_id()` | authenticated_service | Auth/RLS tenant helper |
| 18 | `public.get_auth_profile_tenant_id()` | authenticated_service | Auth/RLS tenant helper |
| 19 | `public.get_channel_analytics(p_days integer)` | service_only | Local body is not proof of live safety; fixed path and role tests required |
| 20 | `public.get_financial_overview()` | service_only | Missing path and live-body review blocker |
| 21 | `public.get_master_clients()` | service_only | Missing path and live-body review blocker |
| 22 | `public.get_master_dashboard_data()` | service_only | Dashboard RPC; exact live-body/admin denial evidence required |
| 23 | `public.get_plan_usage(p_plan_slug text)` | service_only | Privileged read; live-body review blocker |
| 24 | `public.get_plans_with_stats()` | service_only | Missing path and live-body review blocker |
| 25 | `public.get_unique_customers_count(p_tenant_id uuid)` | service_only | Tenant-id parameter ownership is not proven |
| 26 | `public.get_wallet_summary()` | service_only | Privileged read; live-body review blocker |
| 27 | `public.get_wallet_transactions(p_limit integer, p_offset integer, p_agency_id uuid)` | service_only | Parameter authorization and exact live-body safety require proof |
| 28 | `public.handle_new_user_tenant()` | service_only | Trigger; preserve direct service execution only |
| 29 | `public.increment_message_usage(p_tenant_id uuid)` | service_only | Existing server service-role call |
| 30 | `public.is_master_admin()` | service_only | Unsafe dependency until exact live body and fixed path are approved |
| 31 | `public.prevent_agency_deletions()` | service_only | Trigger |
| 32 | `public.prevent_financial_tampering()` | service_only | Trigger |
| 33 | `public.prevent_sent_campaign_deletion()` | service_only | Missing path; trigger blocker |
| 34 | `public.prevent_status_tampering()` | service_only | Trigger |
| 35 | `public.process_wallet_charge(p_agency_id uuid, p_tenant_id uuid, p_amount numeric, p_desc text, p_type character varying)` | service_only | Preserve postgres/service-role-only posture |
| 36 | `public.protect_campaign_fields()` | service_only | Missing path; trigger blocker |
| 37 | `public.send_usage_notification(p_tenant_id uuid, p_agency_id uuid, p_type text, p_message text)` | service_only | Existing server service-role call |
| 38 | `public.suspend_agency_cascade(p_agency_id uuid)` | service_only | Privileged mutation; live-body review blocker |
| 39 | `public.toggle_plan_status(p_plan_id uuid, p_is_active boolean)` | service_only | Privileged mutation; live-body review blocker |
| 40 | `public.update_plan_pricing(p_plan_id uuid, p_price_monthly numeric, p_price_yearly numeric)` | service_only | Privileged mutation; live-body review blocker |
| 41 | `public.validate_campaign_insert()` | service_only | Missing path; trigger blocker |
| 42 | `public.validate_campaign_status()` | service_only | Missing path; trigger blocker |
| 43 | `public.verify_master_admin_role()` | service_only | Local body is not proof of live safety; fixed path and role tests required |
| 44 | `vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid)` | unchanged | Explicitly excluded |
| 45 | `vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid)` | unchanged | Explicitly excluded |

The 13 missing-search-path functions are:
`check_campaign_rate_limit()`, `check_tenant_limit()`,
`get_agency_commission(uuid)` before replacement, `get_channel_analytics(integer)`,
`get_financial_overview()`, `get_master_clients()`, `get_plans_with_stats()`,
`is_master_admin()`, `prevent_sent_campaign_deletion()`,
`protect_campaign_fields()`, `validate_campaign_insert()`,
`validate_campaign_status()`, and `verify_master_admin_role()`.

## 7. Pre-Apply Staging Requirements

The migration contains non-mutating `DO` assertions that stop before body/grant
changes when expected signatures are missing, unexpected public
`SECURITY DEFINER` signatures exist, or `is_master_admin()` lacks an approved
fixed search path. Human approval must also review these SELECT-only snapshots:

```sql
-- Preserve this output as a pre-apply artifact. Review body, owner, config,
-- raw ACL, and effective grants. Do not stage v2.2 without explicit approval.
SELECT
  p.oid::regprocedure AS function_signature,
  pg_get_userbyid(p.proowner) AS owner,
  p.prosecdef,
  p.proconfig,
  p.proacl,
  EXISTS (
    SELECT 1
    FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
    WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
  ) AS public_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc AS p
WHERE p.oid = to_regprocedure('public.is_master_admin()');

-- Must return exactly 42 rows before staging approval. Compare every signature
-- with the migration's expected-signature manifest.
SELECT p.oid::regprocedure AS function_signature
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef
ORDER BY p.oid::regprocedure::text;

-- Capture every direct PUBLIC/anon/authenticated dangerous ACL and every
-- effective anon/authenticated dangerous privilege. Review every affected
-- table/privilege before staging. Direct findings are expected to be revoked;
-- unexplained effective findings require role-membership/ownership review.
WITH public_tables AS (
  SELECT c.oid, n.nspname AS table_schema, c.relname AS table_name,
         c.relacl, c.relowner
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
),
direct_findings AS (
  SELECT
    t.table_schema,
    t.table_name,
    CASE
      WHEN acl.grantee = 0 THEN 'direct PUBLIC'
      ELSE format('direct %I', granted_role.rolname)
    END AS access_path,
    acl.privilege_type
  FROM public_tables AS t
  CROSS JOIN LATERAL aclexplode(
    COALESCE(t.relacl, acldefault('r', t.relowner))
  ) AS acl
  LEFT JOIN pg_roles AS granted_role ON granted_role.oid = acl.grantee
  WHERE acl.privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER')
    AND (
      acl.grantee = 0
      OR granted_role.rolname IN ('anon', 'authenticated')
    )
),
effective_findings AS (
  SELECT
    t.table_schema,
    t.table_name,
    format('effective %I', checked_role.rolname) AS access_path,
    dangerous_privilege.privilege_type
  FROM public_tables AS t
  CROSS JOIN (VALUES ('anon'), ('authenticated')) AS checked_role(rolname)
  CROSS JOIN (VALUES ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'))
    AS dangerous_privilege(privilege_type)
  WHERE has_table_privilege(
    checked_role.rolname::name,
    t.oid,
    dangerous_privilege.privilege_type
  )
)
SELECT * FROM direct_findings
UNION
SELECT * FROM effective_findings
ORDER BY table_schema, table_name, access_path, privilege_type;

-- Must return zero rows before staging apply. These are direct dangerous grants
-- to roles inherited by anon/authenticated and require separately reviewed
-- role/grant remediation; v2.2 never mutates role membership.
SELECT
  n.nspname AS table_schema,
  c.relname AS table_name,
  inherited_role.rolname AS inherited_role,
  acl.privilege_type
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(
  COALESCE(c.relacl, acldefault('r', c.relowner))
) AS acl
JOIN pg_roles AS inherited_role ON inherited_role.oid = acl.grantee
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND acl.privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER')
  AND inherited_role.rolname NOT IN ('anon', 'authenticated')
  AND (
    pg_has_role('anon', inherited_role.oid, 'USAGE')
    OR pg_has_role('authenticated', inherited_role.oid, 'USAGE')
  )
ORDER BY table_schema, table_name, inherited_role, privilege_type;

-- Capture unchanged-object definitions/config/grants before apply for exact
-- comparison with the post-apply snapshot.
SELECT
  p.oid::regprocedure AS function_signature,
  p.proconfig,
  p.proacl,
  pg_get_functiondef(p.oid) AS function_definition,
  EXISTS (
    SELECT 1
    FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
    WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
  ) AS public_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute
FROM pg_proc AS p
WHERE p.oid IN (
  to_regprocedure('pgbouncer.get_auth(text)'),
  to_regprocedure('vault.create_secret(text,text,text,uuid)'),
  to_regprocedure('vault.update_secret(uuid,text,text,text,uuid)')
)
ORDER BY p.oid::regprocedure::text;
```

Exact approval evidence required before restoring authenticated execution to
any v2.2 `service_only` RPC: exact live `pg_get_functiondef`, fixed safe search
path, owner and ACL review, proof that every parameter is authorized, and
authenticated/non-master/cross-tenant staging denial tests. Client dependency
alone is not safety evidence.

## 8. Database Impact

The prerequisite replaces `public.is_master_admin()` with its verified live
body plus `SET search_path = pg_catalog, public`; it asserts preservation of
its existing EXECUTE grants and changes no table data or policies.

V2.2 replaces one function body, changes EXECUTE grants on asserted existing
`public` functions, and revokes `TRUNCATE`/`REFERENCES`/`TRIGGER` from
`PUBLIC`/`anon`/`authenticated` on public tables. It does not alter role
membership, `pgbouncer`, `vault`, table data, table shape, RLS policies, auth
users, storage, or secrets. Any remaining effective dangerous privilege raises
an exception and rolls back the migration transaction.

Tenant isolation improves for agency commission disclosure. Other tenant and
admin authorization claims remain staging blockers until behavior is proven.

## 9. Rollback Strategy

Before apply, capture exact `pg_get_functiondef`, owners, `proconfig`, raw ACLs,
effective EXECUTE privileges, and direct/effective dangerous table privileges.
V2.2 cannot promise exact original individual ACL restoration without that
snapshot.

Do not restore the unsafe commission body or broadly restore `PUBLIC`/`anon`
execution. Restore only exact grants proven necessary from the approved
snapshot. If a critical RPC fails, fail closed first, then deploy a separately
reviewed body/grant correction.

## 10. Post-Apply SELECT Verification

```sql
-- Comprehensive expected-signature and grant-disposition check.
-- Must return zero rows. This detects missing expected signatures, unexpected
-- public SECURITY DEFINER signatures, and grant-disposition mismatches.
WITH expected(signature, disposition) AS (
  VALUES
    ('public.activate_agency_cascade(uuid)', 'service_only'),
    ('public.add_plan(text,text,numeric,numeric,integer,numeric,numeric,text,boolean,boolean,integer)', 'service_only'),
    ('public.add_plan(text,text,numeric,numeric,integer,numeric,numeric,text,boolean,boolean,integer,timestamp with time zone)', 'service_only'),
    ('public.add_wallet_credit(uuid,numeric,text)', 'service_only'),
    ('public.archive_plan(uuid)', 'service_only'),
    ('public.calculate_master_revenue()', 'service_only'),
    ('public.calculate_usage_rate()', 'service_only'),
    ('public.check_campaign_rate_limit()', 'service_only'),
    ('public.check_tenant_limit()', 'service_only'),
    ('public.count_high_usage_tenants()', 'service_only'),
    ('public.count_today_messages()', 'service_only'),
    ('public.create_agency(text,text,text,numeric,text)', 'service_only'),
    ('public.delete_plan(uuid)', 'service_only'),
    ('public.get_agency_commission(uuid)', 'authenticated_service'),
    ('public.get_agency_wallet_balance(uuid)', 'service_only'),
    ('public.get_auth_owned_tenant_id()', 'authenticated_service'),
    ('public.get_auth_profile_tenant_id()', 'authenticated_service'),
    ('public.get_channel_analytics(integer)', 'service_only'),
    ('public.get_financial_overview()', 'service_only'),
    ('public.get_master_clients()', 'service_only'),
    ('public.get_master_dashboard_data()', 'service_only'),
    ('public.get_plan_usage(text)', 'service_only'),
    ('public.get_plans_with_stats()', 'service_only'),
    ('public.get_unique_customers_count(uuid)', 'service_only'),
    ('public.get_wallet_summary()', 'service_only'),
    ('public.get_wallet_transactions(integer,integer,uuid)', 'service_only'),
    ('public.handle_new_user_tenant()', 'service_only'),
    ('public.increment_message_usage(uuid)', 'service_only'),
    ('public.is_master_admin()', 'service_only'),
    ('public.prevent_agency_deletions()', 'service_only'),
    ('public.prevent_financial_tampering()', 'service_only'),
    ('public.prevent_sent_campaign_deletion()', 'service_only'),
    ('public.prevent_status_tampering()', 'service_only'),
    ('public.process_wallet_charge(uuid,uuid,numeric,text,character varying)', 'service_only'),
    ('public.protect_campaign_fields()', 'service_only'),
    ('public.send_usage_notification(uuid,uuid,text,text)', 'service_only'),
    ('public.suspend_agency_cascade(uuid)', 'service_only'),
    ('public.toggle_plan_status(uuid,boolean)', 'service_only'),
    ('public.update_plan_pricing(uuid,numeric,numeric)', 'service_only'),
    ('public.validate_campaign_insert()', 'service_only'),
    ('public.validate_campaign_status()', 'service_only'),
    ('public.verify_master_admin_role()', 'service_only')
),
resolved AS (
  SELECT e.*, to_regprocedure(e.signature) AS oid
  FROM expected AS e
),
actual AS (
  SELECT p.oid, p.oid::regprocedure::text AS signature
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef
)
SELECT 'missing_expected_signature' AS issue, r.signature, r.disposition
FROM resolved AS r
WHERE r.oid IS NULL
UNION ALL
SELECT 'unexpected_security_definer_signature', a.signature, NULL
FROM actual AS a
WHERE NOT EXISTS (SELECT 1 FROM resolved AS r WHERE r.oid = a.oid)
UNION ALL
SELECT 'expected_not_security_definer', r.signature, r.disposition
FROM resolved AS r
WHERE r.oid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM actual AS a WHERE a.oid = r.oid)
UNION ALL
SELECT 'grant_disposition_mismatch', r.signature, r.disposition
FROM resolved AS r
WHERE r.oid IS NOT NULL
  AND (
    EXISTS (
      SELECT 1
      FROM pg_proc AS p2
      CROSS JOIN LATERAL aclexplode(
        COALESCE(p2.proacl, acldefault('f', p2.proowner))
      ) AS acl
      WHERE p2.oid = r.oid
        AND acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    )
    OR has_function_privilege('anon', r.oid, 'EXECUTE')
       IS DISTINCT FROM FALSE
    OR has_function_privilege('service_role', r.oid, 'EXECUTE')
       IS DISTINCT FROM TRUE
    OR has_function_privilege('authenticated', r.oid, 'EXECUTE')
       IS DISTINCT FROM (r.disposition = 'authenticated_service')
  )
ORDER BY issue, signature;

-- Any remaining PUBLIC or anon EXECUTE on public SECURITY DEFINER functions.
-- Must return zero rows.
SELECT
  p.oid::regprocedure AS function_signature,
  EXISTS (
    SELECT 1
    FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
    WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
  ) AS public_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef
  AND (
    EXISTS (
      SELECT 1
      FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
      WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
    )
    OR has_function_privilege('anon', p.oid, 'EXECUTE')
  )
ORDER BY p.oid::regprocedure::text;

-- Dangerous public-table privileges. Must return zero rows. This reports:
-- direct ACL grants to PUBLIC/anon/authenticated, effective inherited/direct
-- privileges for anon/authenticated, and any remaining information_schema rows.
WITH public_tables AS (
  SELECT c.oid, n.nspname AS table_schema, c.relname AS table_name,
         c.relacl, c.relowner
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
),
findings AS (
  SELECT
    t.table_schema,
    t.table_name,
    CASE
      WHEN acl.grantee = 0 THEN 'direct PUBLIC'
      ELSE format('direct %I', granted_role.rolname)
    END AS access_path,
    acl.privilege_type
  FROM public_tables AS t
  CROSS JOIN LATERAL aclexplode(
    COALESCE(t.relacl, acldefault('r', t.relowner))
  ) AS acl
  LEFT JOIN pg_roles AS granted_role ON granted_role.oid = acl.grantee
  WHERE acl.privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER')
    AND (
      acl.grantee = 0
      OR granted_role.rolname IN ('anon', 'authenticated')
    )

  UNION

  SELECT
    t.table_schema,
    t.table_name,
    format('effective %I', checked_role.rolname),
    dangerous_privilege.privilege_type
  FROM public_tables AS t
  CROSS JOIN (VALUES ('anon'), ('authenticated')) AS checked_role(rolname)
  CROSS JOIN (VALUES ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'))
    AS dangerous_privilege(privilege_type)
  WHERE has_table_privilege(
    checked_role.rolname::name,
    t.oid,
    dangerous_privilege.privilege_type
  )

  UNION

  SELECT
    grants.table_schema,
    grants.table_name,
    format('information_schema %I', grants.grantee),
    grants.privilege_type
  FROM information_schema.role_table_grants AS grants
  WHERE grants.table_schema = 'public'
    AND grants.grantee IN ('anon', 'authenticated')
    AND grants.privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER')
)
SELECT table_schema, table_name, access_path, privilege_type
FROM findings
ORDER BY table_schema, table_name, access_path, privilege_type;

-- Must show fixed public search_path, no PUBLIC/anon, authenticated/service true.
SELECT
  p.oid::regprocedure AS function_signature,
  p.prosecdef,
  p.proconfig,
  EXISTS (
    SELECT 1
    FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
    WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
  ) AS public_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE p.oid = 'public.get_agency_commission(uuid)'::regprocedure;

-- Remaining missing-search-path blockers. Expected after v2.2: 11 rows,
-- because is_master_admin() must be hardened before v2.2 can run.
SELECT p.oid::regprocedure AS function_signature, p.proconfig
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef
  AND p.proconfig IS NULL
ORDER BY p.oid::regprocedure::text;

-- Must return exactly three rows and remain byte/config/grant-equivalent to the
-- approved pre-apply snapshot. Missing signatures or any output difference
-- blocks approval; the query alone is not approval.
SELECT
  p.oid::regprocedure AS function_signature,
  p.proconfig,
  p.proacl,
  pg_get_functiondef(p.oid) AS function_definition,
  EXISTS (
    SELECT 1
    FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
    WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
  ) AS public_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE p.oid IN (
  to_regprocedure('pgbouncer.get_auth(text)'),
  to_regprocedure('vault.create_secret(text,text,text,uuid)'),
  to_regprocedure('vault.update_secret(uuid,text,text,text,uuid)')
)
ORDER BY p.oid::regprocedure::text;

-- Must still report the same 39 policies because v2.2 does not rewrite them.
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND roles = ARRAY['public']::name[]
ORDER BY tablename, policyname;
```

Catalog verification is insufficient. Staging behavior tests must prove
master/non-master denial, tenant ownership, trigger operation, webhook/service
calls, and every workflow changed to `service_only`.

## 11. Remaining Blockers Before Staging Apply

- Hermes approval of every function disposition.
- Exact pre-apply snapshot and rollback artifact.
- Pre-apply direct ACL/effective privilege inventory for `PUBLIC`, `anon`, and
  `authenticated`, with zero inherited dangerous grants through parent roles.
- Investigation and separate remediation of any effective dangerous privilege
  not explained by a direct grant that v2.2 revokes.
- Hermes approval and separate staging-apply approval for
  `20260612121000_local_only_is_master_admin_search_path_prerequisite.sql`.
- Successful staging apply and SELECT/behavior verification of the prerequisite
  before v2.2; the current live `proconfig=NULL` still blocks v2.2.
- Pre-apply proof of exactly 42 expected and zero unexpected public
  `SECURITY DEFINER` signatures.
- Explicit staging DB-write approval from Ahmad.
- Acceptance that service-only dispositions may break staging workflows.
- Named staging test owner and test matrix.

## 12. Remaining Blockers Before Production Apply

- Exact live-body authorization review for every retained authenticated RPC.
- Remediation of the remaining 11 missing-search-path functions.
- Resolution of all staging workflow regressions.
- Separate evidence-backed review of all 39 `{public}` RLS policies.
- Completed staging verification, rollback rehearsal, and separate production
  approval.
- Zero direct or effective dangerous public-table privileges for `PUBLIC`,
  `anon`, and `authenticated`, confirmed by the v2.2 post-apply query.

## 13. Confirmation

V2.2 remains local-only. No Supabase connection, migration apply, DB write/DDL/DML,
environment or secret edit, auth/storage/edge-function change, commit, push, or
deployment was performed.

The `is_master_admin()` prerequisite also remains a local-only draft. Production
remains blocked pending prerequisite and v2.2 Hermes review, explicit staging
write approval, staging verification, closure of all production blockers, and
separate production approval.
