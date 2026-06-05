# Automology.ai Production Readiness Preflight

**Product:** AI SaaS Clinics & Restaurants  
**Date:** 2026-06-05  
**Scope:** Read-only overnight production readiness preflight approved by Ahmad.  
**Hard boundary:** No DB writes, no Supabase migrations, no schema changes, no env/secret changes, no Git push, no Vercel deploy/redeploy, no Stripe/Meta production changes.

---

## 1. Executive Summary

**Gatekeeper result:** The deployed app is reachable and core health is green, but the product is **not yet approved for controlled MVP launch**.

**Verified:**

- Vercel project `reportclinics` has a latest Production deployment in `Ready` state.
- Production aliases point to `https://reportclinics.vercel.app` and project URLs.
- Vercel environment variable names were listed without printing secret values.
- Supabase REST read-only checks were performed with a server key available locally; no data rows or secret values were printed.
- Key live tables exist for tenants, profiles, agencies, bookings, messages, conversations, branches, items, tenant API keys, invoices, wallet ledger, plans, and platform settings.
- `tenant_api_keys` and `tenant_api_key_events` are present in live REST schema.
- `verify_master_admin_role` and `is_master_admin` appear in Supabase OpenAPI RPC metadata.

**P0/P1 blockers remain:**

- Vercel Production is missing several env vars required or referenced by code: `PUBLIC_CHAT_TOKEN_SECRET`, `META_APP_SECRET`, `META_ACCESS_TOKEN`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_BASE_URL`, and likely Stripe checkout secrets such as `STRIPE_SECRET_KEY` / publishable key depending on payment path.
- Live `tenants.subscription_status` does **not** exist, while at least one code path expects it.
- Direct PostgreSQL/RLS policy inspection was not available because Supabase CLI/config/MCP SQL access was not available in this run. REST/OpenAPI metadata does **not** prove RLS policy correctness.
- Full post-deploy workflow smoke tests have not been run.

---

## 2. Approval Compliance

**Approved Overnight 1:** Vercel env presence verification only.  
**Status:** Completed.

**Approved Overnight 2:** Supabase live schema/RLS read-only preflight.  
**Status:** Partially completed. Table/column/RPC exposure was checked read-only via REST/OpenAPI. RLS policy internals could not be verified without SQL/MCP access.

**Approved Overnight 3:** Create `docs/production-readiness-preflight.md`.  
**Status:** Completed.

**Approved Overnight 4:** Gatekeeper review and next morning checklist.  
**Status:** Completed in this report.

No writes or production-impacting operations were performed.

---

## 3. Vercel Environment Presence Verification

### 3.1 Verified Vercel Production env names present

`vercel env ls` showed these variables present in Production or Production+Preview. Values were not printed.

- `NEXT_PUBLIC_APP_URL` — Preview, Production
- `RESEND_API_KEY` — Preview, Production
- `CRON_SECRET` — Production
- `SUPER_ADMIN_EMAILS` — Production
- `SUPABASE_SERVICE_ROLE_KEY` — Production
- `MASTER_VAULT_KEY` — Production
- `NEXT_PUBLIC_SUPER_ADMIN_EMAILS` — Production
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Production
- `META_VERIFY_TOKEN` — Production, Preview
- `DATABASE_ENCRYPTION_KEY` — Preview, Production
- `GEMINI_API_KEY` — Production
- `GOOGLE_REDIRECT_URI` — Production
- `GOOGLE_CLIENT_SECRET` — Production
- `GOOGLE_CLIENT_ID` — Production
- `NEXT_PUBLIC_SUPABASE_URL` — Production

### 3.2 Env names referenced by code

Static extraction from source found these referenced env names:

- `CRON_SECRET`
- `DATABASE_ENCRYPTION_KEY`
- `GEMINI_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `META_ACCESS_TOKEN`
- `META_APP_SECRET`
- `META_VERIFY_TOKEN`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NODE_ENV`
- `PUBLIC_CHAT_TOKEN_SECRET`
- `RESEND_API_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VERCEL`

### 3.3 Present/Missing assessment

**Verified present in Vercel Production:**

- `CRON_SECRET`
- `DATABASE_ENCRYPTION_KEY`
- `GEMINI_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `META_VERIFY_TOKEN`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `RESEND_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MASTER_VAULT_KEY`
- `SUPER_ADMIN_EMAILS`
- `NEXT_PUBLIC_SUPER_ADMIN_EMAILS`

**Verified missing or not shown in Vercel Production env list:**

- `PUBLIC_CHAT_TOKEN_SECRET` — **P0** for public chat token issuance/verification.
- `META_APP_SECRET` — **P0/P1** for Meta webhook POST signature verification.
- `META_ACCESS_TOKEN` — **P1**, may be tenant-specific fallback, but global sender path references it.
- `STRIPE_WEBHOOK_SECRET` — **P0/P1** for Stripe webhook validation if billing is enabled.
- `NEXT_PUBLIC_BASE_URL` — **P1**, referenced by code; confirm whether `NEXT_PUBLIC_APP_URL` fully replaces it.

**Likely payment env gap to verify from checkout path:**

- `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` appear in `.env.example` and are commonly required for Stripe checkout, but were not shown in Vercel Production env list. Treat as **P1/P0 if billing is enabled**.

---

## 4. Deployment Context

**Verified via Vercel CLI:**

- Project: `reportclinics`
- Latest production URL: `https://reportclinics.vercel.app`
- Latest deployment observed: `https://reportclinics-frdp45bjy-pyramidologyai-4668s-projects.vercel.app`
- Status: `Ready`
- Environment: `Production`
- Node Version: `24.x`

**Prior Hermes verified:**

- Production home returned HTTP 200.
- Production `/api/health` returned HTTP 200 with JSON `status: ok`.

**Gatekeeper caveat:** HTTP 200 and health status do not prove auth, tenant isolation, payment, AI, WhatsApp, or migration readiness.

---

## 5. Supabase Read-Only Schema / REST Preflight

### 5.1 Access method

Supabase CLI was not available in the shell, and `supabase/config.toml` was not present. Read-only checks used Supabase REST/OpenAPI metadata with local URL/key presence. Secret values were not printed.

**Verified credential presence for checks:**

- `NEXT_PUBLIC_SUPABASE_URL`: present locally
- `SUPABASE_SERVICE_ROLE_KEY`: present locally
- REST key used: service-role key

No rows/data were printed; checks used `limit=0` and metadata endpoints.

### 5.2 Table/column checks

**Verified OK:**

- `profiles`: `id, tenant_id, role, permissions`
- `agencies`: `id, user_id, subscription_status, stripe_account_id`
- `bookings`: `id, tenant_id, customer_name, customer_phone, booking_time, status`
- `messages`: `id, tenant_id`
- `conversations`: `id, tenant_id`
- `branches`: `id, tenant_id`
- `items`: `id, tenant_id, name, price, duration_minutes`
- `tenant_api_keys`: `id, tenant_id, key_hash, status, scopes`
- `tenant_api_key_events`: `id, tenant_id, api_key_id, event_type`
- `audit_logs`: `id`
- `plans`: `id`
- `plan_features`: `id`
- `invoices`: `id, tenant_id`
- `wallet_ledger`: `id`
- `platform_settings`: `id`
- `tenants` core columns: `id, user_id, agency_id, name, status, plan_type, messages_used, messages_limit, custom_domain, trial_ends_at`

**Verified issue:**

- `tenants.subscription_status`: HTTP 400, column does not exist.

**Clarified non-issue / naming:**

- `services` table was missing, but code inspection shows `src/app/(dashboard)/services/page.tsx` uses `items`, not `services`.
- `customers` table was missing, but code inspection shows standard customer listing pulls unique customers from `bookings` for tenant users; master-admin view reads tenants.

### 5.3 OpenAPI metadata checks

**Verified present in REST/OpenAPI table paths:**

- `tenants`
- `profiles`
- `agencies`
- `bookings`
- `messages`
- `conversations`
- `branches`
- `tenant_api_keys`
- `tenant_api_key_events`
- `audit_logs`
- `plans`
- `plan_features`
- `invoices`
- `wallet_ledger`
- `platform_settings`

**Verified missing from REST/OpenAPI table paths:**

- `services` — likely expected because app uses `items`.
- `customers` — likely expected for tenant users because app derives customers from bookings; still confirm product model.

**Verified RPC metadata present:**

- `verify_master_admin_role`
- `is_master_admin`
- `get_channel_analytics`

**Verified RPC metadata missing:**

- `increment_api_key_usage`
- `rotate_tenant_api_key`

**Interpretation:** Missing RPC metadata is not automatically a blocker if the application does not call those RPCs by name. It is a migration/readiness note to compare against migration files.

---

## 6. RLS / Policy Preflight Limitation

**Important limitation:** RLS enabled state and policy definitions were not directly verified because this run did not have SQL/MCP/Supabase CLI introspection access.

REST/OpenAPI table presence confirms Data API exposure/schema cache visibility, but it does **not** prove:

- RLS is enabled on each table.
- Policies are tenant-safe.
- Master admin policies are correct.
- Staff policies are correct.
- Public anonymous policies were removed safely.
- Security definer functions are safely scoped.

**Gatekeeper decision:** Before migrations or MVP launch, Ahmad should approve a dedicated read-only SQL/MCP preflight or manually run Supabase SQL Editor queries and provide results.

---

## 7. P0 Blockers Before Controlled MVP Launch

1. **Missing `PUBLIC_CHAT_TOKEN_SECRET` in Vercel Production env list.**  
   Public chat token route requires this secret. Without it, public chat token issuance/verification can fail.

2. **Missing `META_APP_SECRET` in Vercel Production env list.**  
   Meta webhook POST signature verification depends on this for launch-grade WhatsApp webhook security.

3. **Missing Stripe webhook/checkout secrets in Vercel Production env list if billing is enabled.**  
   `STRIPE_WEBHOOK_SECRET` was referenced by code and not shown. `STRIPE_SECRET_KEY` / publishable Stripe key should also be confirmed before billing launch.

4. **`tenants.subscription_status` column does not exist live.**  
   At least one code path historically queried/used `subscription_status`. Need inspect current live deployed paths and either migrate/align or confirm only `status` is used in production paths.

5. **RLS policies not directly verified.**  
   REST metadata is insufficient for launch approval.

6. **Full smoke test not run.**  
   Auth, onboarding, tenant data flows, staff roles, master admin, agency admin, public chat, external API keys, Stripe, and WhatsApp remain unverified end-to-end.

---

## 8. P1 Before Paid/Public Launch

- Replace in-memory public chat rate limiting with shared production-grade rate limiting.
- Run Stripe test-mode checkout + webhook replay/idempotency checks.
- Run WhatsApp sandbox webhook/send validation.
- Confirm agency commission/Stripe Connect behavior.
- Confirm cron schedules match product expectation.
- Confirm AI quota/cost telemetry and graceful failure behavior.
- Confirm missing `NEXT_PUBLIC_BASE_URL` is harmless or add/standardize env naming.

---

## 9. P2 / Later

- Full white-label agency resale program.
- Voice AI receptionist/call-center agents.
- Omnichannel expansion beyond current WhatsApp/web chat.
- Enterprise compliance/SSO.
- Shared platform extraction / monorepo refactor.

---

## 10. Next Morning Approval Checklist

### Recommended Approval A — commit/push report docs only

`docs/saas-launch-gap-report.md` and `docs/production-readiness-preflight.md` are local/untracked docs. If Ahmad wants these preserved in GitHub:

```text
Approved A: Codex/Hermes may commit and push documentation reports only.

Allowed files:
- docs/saas-launch-gap-report.md
- docs/production-readiness-preflight.md

Restrictions:
- No production code changes.
- No DB writes.
- No migrations.
- No env/secret changes.
- No Vercel deploy/redeploy except any automatic docs-only deployment from GitHub push.
- No force push.
```

### Recommended Approval B — read-only SQL/RLS policy preflight

```text
Approved B: Hermes/Codex may perform Supabase read-only SQL/RLS policy preflight.

Scope:
- Read-only SQL only.
- Verify tables, columns, RLS enabled state, policies, functions/RPCs, and master admin metadata.
- Do not print secret values or sensitive row data.
- Produce a report.

Restrictions:
- No DB writes.
- No migrations.
- No schema changes.
- No env changes.
- No push.
- No deploy.
```

### Recommended Approval C — env remediation plan only

```text
Approved C: Hermes/Codex may prepare an environment remediation plan only.

Scope:
- List missing required Vercel env variable names.
- Explain which features each env variable affects.
- Provide manual Vercel setup checklist for Ahmad.

Restrictions:
- Do not add/change env variables.
- Do not print or request secret values in chat.
- No deploy.
- No DB writes.
```

---

## 11. Gatekeeper Recommendation

Do **not** run Supabase migrations yet.

The next safest step is **read-only SQL/RLS policy preflight** plus an **env remediation plan**. Missing production env names should be resolved before public chat, Meta webhook, Stripe billing, or full MVP smoke testing.

Controlled MVP launch remains blocked until P0 items above are closed.
